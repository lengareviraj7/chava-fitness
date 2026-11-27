import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

const PORT = env.PORT || 5001;

connectDB().then(async () => {
  try {
    const { User } = await import('./models/User.js');
    const { Settings } = await import('./models/Settings.js');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Database is empty, creating default owner and shop settings...');
      await User.create({
        name: 'Chava Owner',
        phone: env.DEFAULT_OWNER_PHONE || '9876543210',
        password: env.DEFAULT_OWNER_PASSWORD || 'Owner@123',
        role: 'owner',
        pin: '1234',
      });
      await Settings.create({
        shopName: 'Chava Fitness Club',
        address: 'Shop No. 5, Fitness Plaza, Pune - 411001',
        phone: '9876543210',
        email: 'chava@fitness.in',
        gstin: '27AABCC1234D1Z5',
        state: 'Maharashtra',
        stateCode: '27',
        receiptFooter: 'Thank you for shopping at Chava Fitness Club! Stay fit, stay strong.',
        staffMaxDiscountPct: 10,
      });
      console.log(`✅ Default owner ready: ${env.DEFAULT_OWNER_PHONE || '9876543210'} / ${env.DEFAULT_OWNER_PASSWORD || 'Owner@123'}`);
    }

    const { Category } = await import('./models/Category.js');
    const catCount = await Category.countDocuments();
    if (catCount === 0) {
      console.log('🌱 Seeding default supplement categories...');
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
      await Category.insertMany(CATEGORIES);
      console.log('✅ Default categories created');
    }

    const { Brand } = await import('./models/Brand.js');
    const brandCount = await Brand.countDocuments();
    if (brandCount === 0) {
      const brandNames = ['MuscleBlaze', 'Optimum Nutrition', 'GNC', 'MyProtein', 'Fast&Up'];
      await Brand.insertMany(brandNames.map((name) => ({ name })));
      console.log('✅ Default brands created');
    }
  } catch (seedErr) {
    console.warn('Auto-seed check notice:', seedErr.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Chava Fitness Club ERP Server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });
});
