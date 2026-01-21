import { createClient } from "npm:@supabase/supabase-js@2.57.4";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

export class RateLimiter {
  private supabase: any;
  private config: RateLimitConfig;

  constructor(supabaseUrl: string, supabaseKey: string, config: RateLimitConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = config;
  }

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      const { data: rateLimitRecord } = await this.supabase
        .from('rate_limits')
        .select('*')
        .eq('key', key)
        .gte('window_start', new Date(windowStart).toISOString())
        .maybeSingle();

      if (!rateLimitRecord) {
        await this.supabase
          .from('rate_limits')
          .insert({
            key,
            count: 1,
            window_start: new Date(now).toISOString(),
            expires_at: new Date(now + this.config.windowMs).toISOString(),
          });

        return {
          allowed: true,
          remaining: this.config.maxRequests - 1,
          resetAt: new Date(now + this.config.windowMs),
        };
      }

      if (rateLimitRecord.count >= this.config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(rateLimitRecord.expires_at),
        };
      }

      await this.supabase
        .from('rate_limits')
        .update({ count: rateLimitRecord.count + 1 })
        .eq('id', rateLimitRecord.id);

      return {
        allowed: true,
        remaining: this.config.maxRequests - rateLimitRecord.count - 1,
        resetAt: new Date(rateLimitRecord.expires_at),
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: true, remaining: this.config.maxRequests, resetAt: new Date(now + this.config.windowMs) };
    }
  }
}

export async function createRateLimitTable(supabase: any) {
  await supabase.rpc('create_rate_limit_table_if_not_exists');
}

export async function checkRateLimit(
  supabase: any,
  userId: string,
  keyPrefix: string = "order",
  maxRequests: number = 10,
  windowMs: number = 60000
): Promise<boolean> {
  const key = `${keyPrefix}:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const { data: rateLimitRecord } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .gte('window_start', new Date(windowStart).toISOString())
      .maybeSingle();

    if (!rateLimitRecord) {
      await supabase.from('rate_limits').insert({
        key,
        count: 1,
        window_start: new Date(now).toISOString(),
        expires_at: new Date(now + windowMs).toISOString(),
      });
      return true;
    }

    if (rateLimitRecord.count >= maxRequests) {
      return false;
    }

    await supabase
      .from('rate_limits')
      .update({ count: rateLimitRecord.count + 1 })
      .eq('id', rateLimitRecord.id);

    return true;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true;
  }
}
