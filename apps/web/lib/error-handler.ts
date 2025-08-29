/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(
    message: string,
    code: string = 'APP_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational

    // Ensures the stack trace points to where the error was thrown
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Handles and transforms various error types into a standardized AppError
 * @param error - The error to handle
 * @returns A standardized AppError
 */
export function handleApiError(error: unknown): AppError {
  // If it's already an AppError, return as is
  if (error instanceof AppError) {
    return error
  }

  // Handle Supabase errors
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  ) {
    const supabaseError = error as {
      code: string
      message: string
      details?: string
    }

    // Map common Supabase error codes to user-friendly messages
    switch (supabaseError.code) {
      case '23505': // unique_violation
        return new AppError(
          'This record already exists.',
          'DUPLICATE_ENTRY',
          400
        )
      case '23503': // foreign_key_violation
        return new AppError(
          'Referenced record not found.',
          'INVALID_REFERENCE',
          400
        )
      case '42501': // insufficient_privilege
        return new AppError('Permission denied.', 'PERMISSION_DENIED', 403)
      case 'PGRST116': // no rows returned
        return new AppError('Resource not found.', 'NOT_FOUND', 404)
      default:
        return new AppError(
          `Database error: ${supabaseError.message}`,
          'DATABASE_ERROR',
          500
        )
    }
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    return new AppError(error.message, 'GENERIC_ERROR', 500)
  }

  // Handle string errors
  if (typeof error === 'string') {
    return new AppError(error, 'STRING_ERROR', 500)
  }

  // Fallback for unknown error types
  return new AppError('An unexpected error occurred.', 'UNKNOWN_ERROR', 500)
}

/**
 * Standard response format for server actions
 */
export interface ErrorResponse {
  success: false
  message: string
  code?: string
}

/**
 * Creates a standardized error response for server actions
 * @param error - The error to convert
 * @returns Standardized error response
 */
export function createErrorResponse(error: unknown): ErrorResponse {
  const appError = handleApiError(error)
  return {
    success: false,
    message: appError.message,
    code: appError.code,
  }
}
