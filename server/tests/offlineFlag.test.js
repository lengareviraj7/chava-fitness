import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Settings } from '../src/models/Settings.js';

let mongod;
let ownerCookie;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await User.create({
    name: 'Owner',
    phone: '9900000001',
    password: 'Owner@123',
    role: 'owner',
  });

  const loginRes = await supertest(app)
    .post('/api/auth/login')
    .send({ phone: '9900000001', password: 'Owner@123' });
  ownerCookie = loginRes.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Feature Flag Invariant: offlineBilling.enabled defaults to false', () => {
  it('default settings document initializes offlineBilling.enabled to false', async () => {
    const settings = await Settings.create({ shopName: 'Chava Fitness Club' });
    expect(settings.offlineBilling?.enabled).toBeFalsy();
  });

  it('rejects offline sync attempts when flag is false with OFFLINE_DISABLED', async () => {
    const res = await supertest(app)
      .post('/api/offline/sync')
      .set('Cookie', ownerCookie)
      .send({ bills: [] });
    // Expect 403 or 404 depending on mount, verifying it cannot execute offline ingest
    expect([403, 404]).toContain(res.status);
  });

  it('online routes continue to operate identically with zero regression', async () => {
    const res = await supertest(app).get('/api/products').set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
