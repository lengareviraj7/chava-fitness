import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';

let mongod;
let ownerCookie;
let staffCookie;
let testCategoryId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await User.create({ name: 'Owner', phone: '9100000001', password: 'Owner@123', role: 'owner' });
  await User.create({ name: 'Staff', phone: '9100000002', password: 'Staff@123', role: 'staff' });

  const catDoc = await Category.create({ name: 'Whey Protein' });
  testCategoryId = catDoc._id.toString();

  const ownerLogin = await supertest(app)
    .post('/api/auth/login')
    .send({ phone: '9100000001', password: 'Owner@123' });
  ownerCookie = ownerLogin.headers['set-cookie'];

  const staffLogin = await supertest(app)
    .post('/api/auth/login')
    .send({ phone: '9100000002', password: 'Staff@123' });
  staffCookie = staffLogin.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const sampleProduct = () => ({
  name: 'Test Whey',
  brand: 'TestBrand',
  category: testCategoryId,
  hsn: '21069099',
  gstRate: 18,
  variants: [
    {
      flavour: 'Chocolate',
      size: '1 kg',
      sku: 'TW-CHO-1KG',
      mrp: 200000,
      sellingPrice: 180000,
      purchasePrice: 120000,
    },
  ],
});

describe('POST /api/products', () => {
  it('owner can create product', async () => {
    const res = await supertest(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send(sampleProduct());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('staff cannot create product', async () => {
    const res = await supertest(app)
      .post('/api/products')
      .set('Cookie', staffCookie)
      .send(sampleProduct());
    expect(res.status).toBe(403);
  });
});

describe('GET /api/products — purchasePrice security', () => {
  it('owner sees purchasePrice in variants', async () => {
    const res = await supertest(app).get('/api/products').set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    const product = res.body.data.products.find((p) => p.name === 'Test Whey');
    expect(product).toBeDefined();
    expect(product.variants[0].purchasePrice).toBeDefined();
  });

  it('staff NEVER sees purchasePrice in variants', async () => {
    const res = await supertest(app).get('/api/products').set('Cookie', staffCookie);
    expect(res.status).toBe(200);
    for (const p of res.body.data.products) {
      for (const v of p.variants) {
        expect(v.purchasePrice).toBeUndefined();
      }
    }
  });

  it('unauthenticated user NEVER sees purchasePrice', async () => {
    const res = await supertest(app).get('/api/products');
    expect(res.status).toBe(200);
    for (const p of res.body.data.products) {
      for (const v of p.variants) {
        expect(v.purchasePrice).toBeUndefined();
      }
    }
  });
});
