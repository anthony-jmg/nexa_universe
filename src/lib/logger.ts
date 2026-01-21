type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  userAgent?: string;
  url?: string;
}

class Logger {
  private isDev = import.meta.env.DEV;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  private createEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
  }

  private store(entry: LogEntry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  info(message: string, data?: unknown) {
    const entry = this.createEntry('info', message, data);
    this.store(entry);
    if (this.isDev) {
      console.log(`[INFO] ${message}`, data);
    }
  }

  warn(message: string, data?: unknown) {
    const entry = this.createEntry('warn', message, data);
    this.store(entry);
    console.warn(`[WARN] ${message}`, data);
  }

  error(message: string, error?: unknown) {
    const entry = this.createEntry('error', message, error);
    this.store(entry);
    console.error(`[ERROR] ${message}`, error);
  }

  debug(message: string, data?: unknown) {
    if (this.isDev) {
      const entry = this.createEntry('debug', message, data);
      this.store(entry);
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();
