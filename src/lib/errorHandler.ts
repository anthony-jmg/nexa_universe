import { PostgrestError } from '@supabase/supabase-js';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleSupabaseError(error: PostgrestError | Error, context?: string): AppError {
  const contextMsg = context ? `[${context}] ` : '';

  if ('code' in error && 'details' in error) {
    const pgError = error as PostgrestError;
    logger.error(`${contextMsg}Supabase error`, {
      code: pgError.code,
      message: pgError.message,
      details: pgError.details,
      hint: pgError.hint,
    });

    let userMessage = 'Une erreur est survenue';

    if (pgError.code === '23505') {
      userMessage = 'Cette entrée existe déjà';
    } else if (pgError.code === '23503') {
      userMessage = 'Référence invalide';
    } else if (pgError.code === 'PGRST116') {
      userMessage = 'Aucune donnée trouvée';
    } else if (pgError.code === '42501') {
      userMessage = 'Accès non autorisé';
    }

    return new AppError(userMessage, pgError.code, undefined, pgError.details);
  }

  logger.error(`${contextMsg}Error`, error);
  return new AppError(error.message || 'Une erreur inattendue est survenue');
}

export function handleNetworkError(error: Error, context?: string): AppError {
  const contextMsg = context ? `[${context}] ` : '';
  logger.error(`${contextMsg}Network error`, error);

  if (!navigator.onLine) {
    return new AppError('Vous êtes hors ligne. Vérifiez votre connexion internet.', 'OFFLINE');
  }

  return new AppError('Erreur de connexion. Veuillez réessayer.', 'NETWORK_ERROR');
}

export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw handleSupabaseError(error as Error, context);
    }
  };
}
