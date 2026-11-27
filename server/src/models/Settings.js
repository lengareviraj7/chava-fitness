import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, trim: true, default: 'Chava Fitness Club' },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    stateCode: { type: String, trim: true, default: '' },
    billPrefix: { type: String, trim: true, default: 'PS' },
    // used for thermal receipt
    upiId: { type: String, trim: true, default: '' },
    footerNote: { type: String, trim: true, default: 'Thank you for shopping with us!' },
  },
  { timestamps: true }
);

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
