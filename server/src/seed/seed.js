/**
 * Seed script: creates owner, shop settings, categories, brands, and sample products.
 * Run: cd server && node src/seed/seed.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
dotenv.config();

import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Brand } from '../models/Brand.js';
import { Product } from '../models/Product.js';
import { Settings } from '../models/Settings.js';

const CATEGORIES = [
  { name: 'Whey Protein', description: 'Fast-absorbing protein powders' },
  { name: 'Mass Gainer', description: 'High-calorie bulking supplements' },
  { name: 'Creatine', description: 'Strength and power supplements' },
  { name: 'Pre-Workout', description: 'Energy and performance enhancers' },
  { name: 'Amino Acids', description: 'BCAAs, EAAs, Glutamine' },
  { name: 'Fat Burners', description: 'Weight management supplements' },
  { name: 'Vitamins & Minerals', description: 'Micronutrient support' },
  { name: 'Accessories', description: 'Shakers, straps, belts, etc.' },
];

async function seed() {
  console.log('🌱 Starting seed...');
  await connectDB();

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Brand.deleteMany({}),
    Product.deleteMany({}),
    Settings.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // Create settings
  await Settings.create({
    shopName: 'Chava Fitness Club',
    address: 'Shop No. 5, Fitness Plaza, Pune - 411001',
    phone: '9876543210',
    email: 'chava@fitness.in',
    gstin: '27AABCC1234D1Z5',
    state: 'Maharashtra',
    stateCode: '27',
    billPrefix: 'CFC',
    upiId: 'chava@upi',
    footerNote: 'Thank you for choosing Chava Fitness Club!',
  });
  console.log('✅ Shop settings created');

  // Create owner
  const owner = await User.create({
    name: 'Chava Owner',
    phone: process.env.DEFAULT_OWNER_PHONE || '9876543210',
    password: process.env.DEFAULT_OWNER_PASSWORD || 'Owner@123',
    role: 'owner',
  });
  console.log(`✅ Owner created: ${owner.phone}`);

  // Create categories
  const cats = await Category.insertMany(CATEGORIES);
  const catMap = Object.fromEntries(cats.map((c) => [c.name, c._id]));
  console.log(`✅ ${cats.length} categories created`);

  // Create brands
  const brandNames = ['MuscleBlaze', 'Optimum Nutrition', 'GNC', 'MyProtein', 'Fast&Up'];
  await Brand.insertMany(brandNames.map((name) => ({ name })));
  console.log(`✅ ${brandNames.length} brands created`);

  // Create sample products
  const products = [
    {
      name: 'Whey Protein Isolate',
      brand: 'MuscleBlaze',
      category: catMap['Whey Protein'],
      hsn: '21069099',
      gstRate: 18,
      variants: [
        { flavour: 'Chocolate', size: '1 kg', sku: 'MB-WPI-CHO-1KG', mrp: 349900, sellingPrice: 319900, purchasePrice: 220000, minStockLevel: 3, stock: 10 },
        { flavour: 'Vanilla', size: '1 kg', sku: 'MB-WPI-VAN-1KG', mrp: 349900, sellingPrice: 319900, purchasePrice: 220000, minStockLevel: 3, stock: 7 },
        { flavour: 'Chocolate', size: '2 kg', sku: 'MB-WPI-CHO-2KG', mrp: 679900, sellingPrice: 629900, purchasePrice: 430000, minStockLevel: 2, stock: 4 },
      ],
    },
    {
      name: 'Real Mass Gainer',
      brand: 'MuscleBlaze',
      category: catMap['Mass Gainer'],
      hsn: '21069099',
      gstRate: 18,
      variants: [
        { flavour: 'Chocolate', size: '3 kg', sku: 'MB-RMG-CHO-3KG', mrp: 199900, sellingPrice: 179900, purchasePrice: 110000, minStockLevel: 3, stock: 8 },
        { flavour: 'Vanilla', size: '3 kg', sku: 'MB-RMG-VAN-3KG', mrp: 199900, sellingPrice: 179900, purchasePrice: 110000, minStockLevel: 3, stock: 2 },
      ],
    },
    {
      name: 'Creatine Monohydrate',
      brand: 'GNC',
      category: catMap['Creatine'],
      hsn: '29362800',
      gstRate: 12,
      variants: [
        { flavour: 'Unflavoured', size: '300 g', sku: 'GNC-CM-UNF-300G', mrp: 89900, sellingPrice: 79900, purchasePrice: 50000, minStockLevel: 5, stock: 15 },
      ],
    },
    {
      name: 'C4 Pre-Workout',
      brand: 'Fast&Up',
      category: catMap['Pre-Workout'],
      hsn: '21069099',
      gstRate: 18,
      variants: [
        { flavour: 'Watermelon', size: '30 servings', sku: 'FU-C4-WM-30SRV', mrp: 149900, sellingPrice: 139900, purchasePrice: 90000, minStockLevel: 3, stock: 1 },
        { flavour: 'Fruit Punch', size: '30 servings', sku: 'FU-C4-FP-30SRV', mrp: 149900, sellingPrice: 139900, purchasePrice: 90000, minStockLevel: 3, stock: 0 },
      ],
    },
    {
      name: 'BCAA 2:1:1',
      brand: 'MyProtein',
      category: catMap['Amino Acids'],
      hsn: '29224990',
      gstRate: 12,
      variants: [
        { flavour: 'Mango', size: '250 g', sku: 'MP-BCAA-MNG-250G', mrp: 79900, sellingPrice: 69900, purchasePrice: 44000, minStockLevel: 4, stock: 20 },
        { flavour: 'Green Apple', size: '250 g', sku: 'MP-BCAA-GA-250G', mrp: 79900, sellingPrice: 69900, purchasePrice: 44000, minStockLevel: 4, stock: 6 },
      ],
    },
    {
      name: 'Gold Standard Whey',
      brand: 'Optimum Nutrition',
      category: catMap['Whey Protein'],
      hsn: '21069099',
      gstRate: 18,
      variants: [
        { flavour: 'Double Rich Chocolate', size: '2 lbs', sku: 'ON-GSW-DRC-2LB', mrp: 299900, sellingPrice: 269900, purchasePrice: 190000, minStockLevel: 2, stock: 5 },
        { flavour: 'Extreme Milk Chocolate', size: '2 lbs', sku: 'ON-GSW-EMC-2LB', mrp: 299900, sellingPrice: 269900, purchasePrice: 190000, minStockLevel: 2, stock: 3 },
      ],
    },
    {
      name: 'Multivitamin Daily',
      brand: 'GNC',
      category: catMap['Vitamins & Minerals'],
      hsn: '21069099',
      gstRate: 12,
      variants: [
        { flavour: 'Unflavoured', size: '60 tablets', sku: 'GNC-MV-UNF-60TAB', mrp: 59900, sellingPrice: 49900, purchasePrice: 28000, minStockLevel: 5, stock: 25 },
      ],
    },
    {
      name: 'Gym Shaker Bottle',
      brand: 'MuscleBlaze',
      category: catMap['Accessories'],
      hsn: '39249090',
      gstRate: 18,
      variants: [
        { flavour: 'Black', size: '700 ml', sku: 'MB-SHK-BLK-700', mrp: 49900, sellingPrice: 39900, purchasePrice: 18000, minStockLevel: 10, stock: 30 },
        { flavour: 'Green', size: '700 ml', sku: 'MB-SHK-GRN-700', mrp: 49900, sellingPrice: 39900, purchasePrice: 18000, minStockLevel: 10, stock: 12 },
      ],
    },
  ];

  await Product.insertMany(products);
  console.log(`✅ ${products.length} products created`);

  console.log('\n🎉 Seed complete!');
  console.log(`   Owner login: ${owner.phone} / ${process.env.DEFAULT_OWNER_PASSWORD || 'Owner@123'}`);

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
