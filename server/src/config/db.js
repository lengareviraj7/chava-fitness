import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer = null;

export const connectDB = async (customUri) => {
  try {
    let uri = customUri || env.MONGODB_URI;

    if (!uri && env.NODE_ENV !== 'production') {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      console.log('⚡ Using In-Memory MongoDB for local development:', uri);
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(` Connected to MongoDB: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(' MongoDB connection failed:', error.message);
    if (env.NODE_ENV !== 'production' && !memoryServer) {
      console.log('⚡ Falling back to embedded MongoMemoryServer...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      const fallbackUri = memoryServer.getUri();
      await mongoose.connect(fallbackUri);
      console.log(` Connected to In-Memory MongoDB: ${mongoose.connection.host}`);
    } else {
      process.exit(1);
    }
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
};
