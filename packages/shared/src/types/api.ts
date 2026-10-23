/**
 * INS Solar Business Management Software — Shared API Response Envelopes
 * Standardized across all RESTful endpoints in /api/v1.
 */

import { ErrorCode } from './enums.js';

export interface ApiMeta {
  timestamp: string;
  correlationId: string;
}

export interface ApiPagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  pagination?: ApiPagination;
  meta: ApiMeta;
}

export interface ApiErrorDetail {
  field?: string;
  issue: string;
}

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  details?: ApiErrorDetail[];
  correlationId: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthCheckLiveResponse {
  status: 'alive';
  uptimeSeconds: number;
  timestamp: string;
}

export interface HealthCheckReadyResponse {
  status: 'ready' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected' | 'unconfigured';
  timestamp: string;
}
