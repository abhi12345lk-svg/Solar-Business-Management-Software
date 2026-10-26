import { ErrorCode, ApiErrorDetail } from '@ins-solar/shared';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ApiErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    arg2: ErrorCode | string,
    arg3?: ErrorCode | string,
    details?: ApiErrorDetail[],
    isOperational = true
  ) {
    let code: ErrorCode;
    let message: string;

    if (Object.values(ErrorCode).includes(arg2 as ErrorCode)) {
      code = arg2 as ErrorCode;
      message = typeof arg3 === 'string' ? arg3 : String(arg2);
    } else if (arg3 && Object.values(ErrorCode).includes(arg3 as ErrorCode)) {
      message = String(arg2);
      code = arg3 as ErrorCode;
    } else {
      message = String(arg2);
      code = statusCode >= 500 ? ErrorCode.INTERNAL_SERVER_ERROR : ErrorCode.VALIDATION_FAILED;
    }

    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static validation(errOrMessage: any, details?: ApiErrorDetail[]): AppError {
    if (typeof errOrMessage === 'string') {
      return new AppError(400, ErrorCode.VALIDATION_FAILED, errOrMessage, details);
    }
    const message =
      errOrMessage?.errors?.[0]?.message || errOrMessage?.message || 'Validation failed.';
    const zodDetails = errOrMessage?.errors?.map((e: any) => ({
      field: e.path ? e.path.join('.') : undefined,
      message: e.message
    }));
    return new AppError(400, ErrorCode.VALIDATION_FAILED, message, details || zodDetails);
  }

  static badRequest(message: string, details?: ApiErrorDetail[]): AppError {
    return new AppError(400, ErrorCode.VALIDATION_FAILED, message, details);
  }

  static validationFailed(message: string, details?: ApiErrorDetail[]): AppError {
    return new AppError(400, ErrorCode.VALIDATION_FAILED, message, details);
  }

  static insufficientStock(message: string): AppError {
    return new AppError(400, ErrorCode.BUSINESS_RULE_VIOLATION, message);
  }

  static businessRule(message: string): AppError {
    return new AppError(422, ErrorCode.BUSINESS_RULE_VIOLATION, message);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(404, ErrorCode.RESOURCE_NOT_FOUND, `${resource} not found.`);
  }

  static forbidden(message = 'Permission denied.'): AppError {
    return new AppError(403, ErrorCode.PERMISSION_DENIED, message);
  }

  static permissionDenied(message = 'Permission denied.'): AppError {
    return new AppError(403, ErrorCode.PERMISSION_DENIED, message);
  }

  static unauthorized(message = 'Authentication required.'): AppError {
    return new AppError(401, ErrorCode.AUTHENTICATION_REQUIRED, message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, ErrorCode.DUPLICATE_RESOURCE, message);
  }

  static duplicateResource(message: string): AppError {
    return new AppError(409, ErrorCode.DUPLICATE_RESOURCE, message);
  }

  static invalidStateTransition(message: string): AppError {
    return new AppError(422, ErrorCode.INVALID_STATE_TRANSITION, message);
  }

  static database(message = 'Database unavailable.'): AppError {
    return new AppError(503, ErrorCode.DATABASE_UNAVAILABLE, message);
  }

  static internal(message = 'An unexpected internal error occurred.'): AppError {
    return new AppError(500, ErrorCode.INTERNAL_SERVER_ERROR, message, undefined, false);
  }
}
