import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { Product } from '../src/models/Product.js';
import { normalizeDupKey } from '../src/utils/dupKey.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function runMigration() {
  console.log('🔄 Starting idempotent migration: product.dupKey backfill...');

  const products = await Product.find({});
  console.log(`📦 Found ${products.length} total products to check.`);

  const seen = new Map();
  const collisions = [];
  let updatedCount = 0;
  let alreadySetCount = 0;

  for (const p of products) {
    const key = normalizeDupKey(p.brand, p.name, p.category);

    if (seen.has(key)) {
      const prior = seen.get(key);
      collisions.push({
        dupKey: key,
        product1: { _id: prior._id, name: prior.name, brand: prior.brand },
        product2: { _id: p._id, name: p.name, brand: p.brand },
      });
      console.warn(
        `⚠️ COLLISION DETECTED for key "${key}":\n` +
        `   Product A: "${prior.name}" (${prior._id})\n` +
        `   Product B: "${p.name}" (${p._id})\n` +
        `   No records were merged or deleted.`
      );
    } else {
      seen.set(key, p);
    }

    if (p.dupKey !== key) {
      await Product.findByIdAndUpdate(p._id, { dupKey: key });
      updatedCount++;
    } else {
      alreadySetCount++;
    }
  }

  // Ensure index is created
  try {
    await Product.collection.createIndex(
      { dupKey: 1 },
      {
        unique: true,
        partialFilterExpression: { isActive: true, dupKey: { $type: 'string', $gt: '' } },
        background: true,
      }
    );
    console.log('✅ Partial unique index on dupKey verified.');
  } catch (idxErr) {
    console.warn(`Index notice: ${idxErr.message}`);
  }

  console.log(
    `🎉 Migration complete! Scanned: ${products.length}, Updated: ${updatedCount}, Already Valid: ${alreadySetCount}, Collisions: ${collisions.length}.`
  );

  return { total: products.length, updated: updatedCount, collisions };
}

// Run directly if called as CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chava-fitness';
  mongoose
    .connect(uri)
    .then(async () => {
      await runMigration();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
