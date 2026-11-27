import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Product } from '../src/models/Product.js';
import { Category } from '../src/models/Category.js';

let mongod;
let ownerCookie;
let staffCookie;

const FORBIDDEN_STAFF_KEYS = new Set([
  'purchasePrice',
  'unitCostPaise',
  'costTotalPaise',
  'cost',
  'profit',
  'margin',
  'stockValue',
  'retailValue',
  'supplierDetails',
  'onOrderQty',
  'purchaseOrder',
  'expectedUnitCostPaise',
  'syncIssues',
  'rawPayload',
  'deviceToken',
]);

function scanForForbiddenKeys(obj, path = '', found = []) {
  if (!obj || typeof obj !== 'object') return found;

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => scanForForbiddenKeys(item, `${path}[${idx}]`, found));
    return found;
  }

  for (const [key, val] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_STAFF_KEYS.has(key)) {
      found.push({ key, path: currentPath });
    }
    if (val && typeof val === 'object') {
      scanForForbiddenKeys(val, currentPath, found);
    }
  }
  return found;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await User.create({ name: 'Owner User', phone: '9800000001', password: 'Owner@123', role: 'owner' });
  await User.create({ name: 'Staff User', phone: '9800000002', password: 'Staff@123', role: 'staff' });

  const cat = await Category.create({ name: 'Proteins' });
  await Product.create({
    name: 'Gold Whey',
    brand: 'ON',
    category: cat._id,
    hsn: '21069099',
    gstRate: 18,
    variants: [
      { flavour: 'Chocolate', size: '1kg', sku: 'ON-GW-1KG', mrp: 300000, sellingPrice: 280000, purchasePrice: 190000, stock: 10 },
    ],
  });

  const ownerLogin = await supertest(app).post('/api/auth/login').send({ phone: '9800000001', password: 'Owner@123' });
  ownerCookie = ownerLogin.headers['set-cookie'];

  const staffLogin = await supertest(app).post('/api/auth/login').send({ phone: '9800000002', password: 'Staff@123' });
  staffCookie = staffLogin.headers['set-cookie'];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Area 5: Security & Authorization Re-scan', () => {
  describe('Express Route Access Policy Audit', () => {
    it('declares and verifies an explicit security policy for mounted routes', async () => {
      // 1. Public route
      const health = await supertest(app).get('/health');
      expect(health.status).toBe(200);

      // 2. Owner-only route: staff must be 403, owner 200/201
      const staffUserList = await supertest(app).get('/api/users').set('Cookie', staffCookie);
      expect(staffUserList.status).toBe(403);

      const ownerUserList = await supertest(app).get('/api/users').set('Cookie', ownerCookie);
      expect(ownerUserList.status).toBe(200);

      // 3. Unauthenticated request to protected route must be 401
      const anonUsers = await supertest(app).get('/api/users');
      expect(anonUsers.status).toBe(401);
    });
  });

  describe('Recursive Staff Sensitive Data Leak Scan', () => {
    it('verifies GET /api/products returns zero forbidden keys for Staff session', async () => {
      const res = await supertest(app).get('/api/products').set('Cookie', staffCookie);
      expect(res.status).toBe(200);

      const violations = scanForForbiddenKeys(res.body);
      expect(violations).toHaveLength(0);
    });

    it('verifies GET /api/dashboard omits profit, costs and dues for Staff session', async () => {
      const res = await supertest(app).get('/api/dashboard').set('Cookie', staffCookie);
      expect(res.status).toBe(200);

      const violations = scanForForbiddenKeys(res.body);
      expect(violations).toHaveLength(0);
      expect(res.body.data.profitPaise).toBeUndefined();
    });

    it('confirms Owner session receives authorized financial data', async () => {
      const res = await supertest(app).get('/api/products').set('Cookie', ownerCookie);
      expect(res.status).toBe(200);
      const product = res.body.data.products[0];
      expect(product.variants[0].purchasePrice).toBeDefined();
    });
  });

  describe('Security Headers & Transport Protection', () => {
    it('enforces Helmet security headers on all responses', async () => {
      const res = await supertest(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('sets HttpOnly on authentication JWT cookie', async () => {
      const res = await supertest(app).post('/api/auth/login').send({ phone: '9800000001', password: 'Owner@123' });
      const setCookie = res.headers['set-cookie'][0];
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
    });
  });
});
