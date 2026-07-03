import mongoose from 'mongoose';
import { config } from './config';

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    console.log('[GuildOS DB] Database already connected');
    return mongoose;
  }

  if (!connectionPromise) {
    console.log('[GuildOS DB] Connecting to database...');
    connectionPromise = mongoose.connect(config.mongoUri, {
      autoIndex: true,
    });
  }


  await connectionPromise;
  console.log('[GuildOS DB] Database connected');
  return mongoose;
}
