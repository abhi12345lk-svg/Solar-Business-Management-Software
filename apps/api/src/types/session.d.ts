import 'express-session';
import { SessionUserPayload, SessionCustomerPayload } from '@ins-solar/shared';

declare module 'express-session' {
  interface SessionData {
    user?: SessionUserPayload;
    customer?: SessionCustomerPayload;
    csrfSecret?: string;
    mfaChallenge?: {
      userId: string;
      challengeToken: string;
      expiresAt: number;
    };
    lastActivity?: number;
    createdAt?: number;
  }
}
