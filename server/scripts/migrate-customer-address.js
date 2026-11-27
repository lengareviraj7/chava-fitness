import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Settings } from '../src/models/Settings.js';

export async function runMigration() {
  console.log('--- Starting Migration: defaultCustomerAddress ---');
  await connectDB();

  try {
    let settings = await Settings.findOne();
    if (!settings) {
      console.log('No settings document found. Creating default settings with Visapur.');
      settings = await Settings.create({
        shopName: 'Chava Fitness Club',
        defaultCustomerAddress: 'Visapur',
      });
    } else if (!settings.defaultCustomerAddress) {
      console.log('Setting defaultCustomerAddress to "Visapur" on existing settings.');
      settings.defaultCustomerAddress = 'Visapur';
      await settings.save();
    } else {
      console.log(`Settings already has defaultCustomerAddress: "${settings.defaultCustomerAddress}" (No-op).`);
    }

    console.log('Migration complete. Existing customers and bills left intact.');
    return { success: true, defaultCustomerAddress: settings.defaultCustomerAddress };
  } finally {
    await disconnectDB();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => {
      console.log('Migration succeeded.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
