import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Create owner for tests
  await User.create({
    name: 'Test Owner',
    phone: '9000000001',
    password: 'TestOwner@123',
    role: 'owner',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('POST /api/auth/login', () => {
  it('returns token on valid credentials', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ phone: '9000000001', password: 'TestOwner@123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('owner');
    // Cookie should be set
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ phone: '9000000001', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects non-existent user', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ phone: '0000000000', password: 'anything' });
    expect(res.status).toBe(401);
  });

  it('rejects missing fields', async () => {
    const res = await supertest(app).post('/api/auth/login').send({ phone: '9000000001' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user when authenticated', async () => {
    // Login to get cookie
    const login = await supertest(app)
      .post('/api/auth/login')
      .send({ phone: '9000000001', password: 'TestOwner@123' });
    const cookie = login.headers['set-cookie'];

    const me = await supertest(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.phone).toBe('9000000001');
  });

  it('returns 401 without token', async () => {
    const res = await supertest(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
