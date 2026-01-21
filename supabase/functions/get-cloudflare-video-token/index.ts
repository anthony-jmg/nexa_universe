import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  videoId: string;
}

async function getSignedVideoUrl(
  accountId: string,
  videoId: string,
  apiToken: string,
  expiresIn: number = 3600
): Promise<{ signedUrl: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}/token`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        exp: expiresAt,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare API error: ${error}`);
  }

  const data = await response.json();
  return {
    signedUrl: data.result.token,
    expiresAt,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[STEP 1] Starting video token generation');

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[STEP 2] Auth header present:', !!authHeader);

    if (!authHeader) {
      console.log('[ERROR] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[STEP 3] Environment variables loaded:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey
    });

    // Client for user authentication
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Client for database queries (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[STEP 4] Supabase clients created');

    // Get the current user
    console.log('[STEP 5] Attempting to get user...');
    const { data: { user }, error: userError } = await authClient.auth.getUser();

    console.log('[STEP 6] User auth result:', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!userError,
      errorMessage: userError?.message
    });

    if (userError || !user) {
      console.log('[ERROR] User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    console.log('[STEP 7] Parsing request body...');
    const { videoId }: RequestBody = await req.json();
    console.log('[STEP 8] VideoId from request:', videoId);

    if (!videoId) {
      console.log('[ERROR] Missing videoId');
      return new Response(
        JSON.stringify({ error: 'Missing videoId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user has access to this video
    console.log('[STEP 9] Fetching video from database...');
    const { data: video, error: videoError } = await adminClient
      .from('videos')
      .select('id, cloudflare_video_id, category, price, professor_id, program_id, visibility')
      .eq('id', videoId)
      .maybeSingle();

    console.log('[STEP 10] Video fetch result:', {
      hasVideo: !!video,
      videoId: video?.id,
      professorId: video?.professor_id,
      visibility: video?.visibility,
      hasCloudflareId: !!video?.cloudflare_video_id,
      hasError: !!videoError,
      errorMessage: videoError?.message
    });

    if (videoError || !video) {
      console.log('[ERROR] Video not found:', videoError);
      return new Response(
        JSON.stringify({ error: 'Video not found', details: videoError?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!video.cloudflare_video_id) {
      console.error('Video missing cloudflare_video_id:', videoId);
      return new Response(
        JSON.stringify({
          error: 'This video is not configured for Cloudflare streaming',
          videoId: videoId
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is the professor owner or admin
    console.log('[STEP 11] Checking user profile...');
    const { data: userProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    console.log('[STEP 12] User profile:', {
      hasProfile: !!userProfile,
      role: userProfile?.role
    });

    const isOwner = video.professor_id === user.id;
    const isAdmin = userProfile?.role === 'admin';

    console.log('[STEP 13] Access check:', {
      userId: user.id,
      professorId: video.professor_id,
      isOwner,
      isAdmin,
      visibility: video.visibility
    });

    // Professors and admins always have access to videos
    if (isOwner || isAdmin) {
      console.log('[STEP 14] Access granted: Owner or Admin');
    } else if (video.visibility === 'public') {
      console.log('[STEP 14] Access granted: Public video');
      // Public videos are accessible to all authenticated users
    } else if (video.visibility === 'paid') {
      // Check if user has purchased the video or program
      let hasAccess = false;

      if (video.program_id) {
        const { data: programPurchase } = await adminClient
          .from('program_purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('program_id', video.program_id)
          .eq('status', 'active')
          .maybeSingle();

        if (programPurchase) {
          hasAccess = true;
        }

        if (!hasAccess && video.professor_id) {
          const { data: subscription } = await adminClient
            .from('professor_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('professor_id', video.professor_id)
            .eq('status', 'active')
            .maybeSingle();

          if (subscription) {
            hasAccess = true;
          }
        }
      } else {
        const { data: videoPurchase } = await adminClient
          .from('video_purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('video_id', videoId)
          .eq('status', 'active')
          .maybeSingle();

        if (videoPurchase) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Access denied. Purchase or subscription required.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (video.visibility === 'subscribers_only') {
      // Check if user has active subscription to the professor
      if (!video.professor_id) {
        return new Response(
          JSON.stringify({ error: 'Access denied. Invalid video configuration.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: subscription } = await adminClient
        .from('professor_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('professor_id', video.professor_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!subscription) {
        return new Response(
          JSON.stringify({ error: 'Access denied. Active subscription required.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (video.visibility === 'private') {
      // Private videos are not accessible
      return new Response(
        JSON.stringify({ error: 'Access denied. This video is private.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[STEP 15] Preparing to generate Cloudflare token');

    const cfAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const cfApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');

    console.log('[STEP 16] Cloudflare config:', {
      hasAccountId: !!cfAccountId,
      hasApiToken: !!cfApiToken,
      cloudflareVideoId: video.cloudflare_video_id
    });

    if (!cfAccountId || !cfApiToken) {
      console.log('[ERROR] Cloudflare not configured');
      return new Response(
        JSON.stringify({ error: 'Streaming service not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[STEP 17] Calling Cloudflare API...');
    const { signedUrl, expiresAt } = await getSignedVideoUrl(
      cfAccountId,
      video.cloudflare_video_id,
      cfApiToken,
      3600
    );

    console.log('[STEP 18] Cloudflare token generated successfully');

    return new Response(
      JSON.stringify({
        token: signedUrl,
        videoId: video.cloudflare_video_id,
        expiresAt,
        expiresIn: 3600
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ERROR] Exception caught:', error);
    console.error('[ERROR] Stack trace:', error.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
