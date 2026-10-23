import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-correlation-id'];
  const correlationId =
    typeof existingId === 'string' && existingId.trim() !== ''
      ? existingId.trim()
      : crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}
