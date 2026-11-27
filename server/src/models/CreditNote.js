import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    nameSnapshot: { type: String, required: true },
    flavour: { type: String, default: '' },
    size: { type: String, default: '' },
    hsn: { type: String, default: '21069099' },
    gstRate: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    stockOutcome: { type: String, enum: ['sealed', 'damaged'], default: 'sealed' },
    mrpPaise: { type: Number, required: true },
    unitPricePaise: { type: Number, required: true },
    netPaise: { type: Number, required: true },
    taxablePaise: { type: Number, required: true },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    costReturnedPaise: { type: Number, default: 0 },
    restoredTo: [
      {
        batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockBatch' },
        qty: { type: Number },
      },
    ],
  },
  { _id: true }
);

const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    fy: {
      type: String,
      required: true,
      index: true,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
      index: true,
    },
    billNoSnapshot: {
      type: String,
      required: true,
    },
    customerSnapshot: {
      name: { type: String, default: 'Walk-in Customer' },
      phone: { type: String, default: '' },
      gstin: { type: String, default: '' },
      state: { type: String, default: 'Maharashtra' },
      address: { type: String, default: '' },
    },
    items: [returnItemSchema],
    totals: {
      taxablePaise: { type: Number, required: true },
      cgstPaise: { type: Number, default: 0 },
      sgstPaise: { type: Number, default: 0 },
      igstPaise: { type: Number, default: 0 },
    },
    roundOffPaise: { type: Number, default: 0 },
    grandTotalPaise: { type: Number, required: true },
    settlement: {
      adjustedAgainstDuePaise: { type: Number, default: 0 },
      payouts: [
        {
          mode: { type: String, enum: ['cash', 'upi', 'card'], required: true },
          amountPaise: { type: Number, required: true },
          refNo: { type: String, default: '' },
        },
      ],
    },
    reason: {
      type: String,
      enum: ['changed_mind', 'wrong_item', 'damaged_product', 'expired_product', 'other'],
      default: 'other',
    },
    note: { type: String, default: '' },
    profitAdjustmentPaise: { type: Number, default: 0 },
    withinWindow: { type: Boolean, default: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const CreditNote =
  mongoose.models.CreditNote || mongoose.model('CreditNote', creditNoteSchema);
