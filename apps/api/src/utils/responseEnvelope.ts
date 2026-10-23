import { Request, Response } from 'express';
import {
  ApiSuccessResponse,
  ApiPagination,
  ApiErrorResponse,
  ApiErrorPayload
} from '@ins-solar/shared';

export function sendSuccess<T>(
  req: Request,
  res: Response,
  data: T,
  statusCode = 200,
  pagination?: ApiPagination
): Response<ApiSuccessResponse<T>> {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId || 'unknown'
    }
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  errorPayload: ApiErrorPayload,
  statusCode = 500
): Response<ApiErrorResponse> {
  const payload: ApiErrorResponse = {
    success: false,
    error: errorPayload
  };

  return res.status(statusCode).json(payload);
}
