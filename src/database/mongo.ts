import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectMongo(): Promise<typeof mongoose> {
  loadEnv();

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI ortam değişkeni eksik.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectPromise) {
    connectPromise = mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });
  }

  await connectPromise;
  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connectPromise = null;
}
