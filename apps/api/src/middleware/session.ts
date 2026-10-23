import session from 'express-session';
import MongoStore from 'connect-mongo';
import { RequestHandler } from 'express';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors/AppError.js';

let sessionStore: session.Store;

if (config.MONGODB_URI) {
  sessionStore = MongoStore.create({
    mongoUrl: config.MONGODB_URI,
    collectionName: 'sessions',
    ttl: Math.floor(config.SESSION_MAX_AGE_MS / 1000),
    autoRemove: 'native',
    touchAfter: 24 * 3600 // touch only once per day unless data changed
  });
  logger.info('Initialized MongoDB session store.');
} else {
  if (config.NODE_ENV === 'production') {
    throw new Error('FATAL: Insecure configuration. MongoDB session store required in production.');
  }
  logger.warn(
    'No MONGODB_URI provided. Initialized in-memory session store for local dev/testing.'
  );
  sessionStore = new session.MemoryStore();
}

export { sessionStore };

export const sessionMiddleware = session({
  name: 'ins_session',
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
    sameSite: config.COOKIE_SAME_SITE,
    maxAge: config.SESSION_MAX_AGE_MS,
    path: '/'
  }
});

/**
 * Enforces idle timeout and absolute session lifetime.
 */
export const sessionTimeoutMiddleware: RequestHandler = (req, _res, next) => {
  if (!req.session || (!req.session.user && !req.session.customer)) {
    return next();
  }

  const now = Date.now();

  // 1. Check absolute session expiration
  if (req.session.createdAt && now - req.session.createdAt > config.SESSION_MAX_AGE_MS) {
    req.session.destroy(err => {
      if (err) {
        logger.error({ err }, 'Failed to destroy expired session');
      }
      return next(AppError.unauthorized('Session has expired. Please log in again.'));
    });
    return;
  }

  // 2. Check idle expiration
  if (req.session.lastActivity && now - req.session.lastActivity > config.SESSION_IDLE_TIMEOUT_MS) {
    req.session.destroy(err => {
      if (err) {
        logger.error({ err }, 'Failed to destroy idle session');
      }
      return next(AppError.unauthorized('Session has expired due to inactivity.'));
    });
    return;
  }

  // Update timestamps
  if (!req.session.createdAt) {
    req.session.createdAt = now;
  }
  req.session.lastActivity = now;

  next();
};
