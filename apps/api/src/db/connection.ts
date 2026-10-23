import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type DatabaseState = 'connected' | 'disconnected' | 'unconfigured';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private isExplicitlyConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async connect(): Promise<DatabaseState> {
    const uri = config.MONGODB_URI;

    if (!uri || uri.trim() === '') {
      logger.info('MONGODB_URI not configured. Operating in offline/degraded database mode.');
      this.isExplicitlyConnected = false;
      return 'unconfigured';
    }

    try {
      // Connect to MongoDB without logging connection credentials
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: config.NODE_ENV !== 'production'
      });

      this.isExplicitlyConnected = true;
      logger.info('Successfully established connection to MongoDB.');
      return 'connected';
    } catch (error) {
      this.isExplicitlyConnected = false;
      const message = error instanceof Error ? error.message : 'Unknown connection error';
      logger.warn({ error: message }, 'Failed to establish connection to MongoDB.');
      return 'disconnected';
    }
  }

  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.isExplicitlyConnected = false;
      logger.info('Disconnected from MongoDB.');
    }
  }

  public getState(): DatabaseState {
    if (!config.MONGODB_URI || config.MONGODB_URI.trim() === '') {
      return 'unconfigured';
    }
    return mongoose.connection.readyState === 1 && this.isExplicitlyConnected
      ? 'connected'
      : 'disconnected';
  }

  public isReady(): boolean {
    return this.getState() === 'connected';
  }

  /**
   * Safely synchronizes indexes on models without dropping existing data or collections.
   */
  public async syncIndexes(): Promise<void> {
    if (this.getState() !== 'connected') {
      logger.warn('Cannot synchronize indexes: Database is not connected.');
      return;
    }

    try {
      await Promise.all(
        Object.values(mongoose.models).map(async model => {
          await model.syncIndexes();
        })
      );
      logger.info('Database indexes synchronized successfully.');
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Error synchronizing database indexes.');
      throw err;
    }
  }
}

export const dbManager = DatabaseManager.getInstance();
