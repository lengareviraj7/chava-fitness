import mongoose from 'mongoose';

const billAllocationSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockBatch',
      required: true,
    },
    batchNo: {
      type: String,
      required: true,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    unitCostPaise: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const billItemSchema = new mongoose.Schema(
  {
    lineId: {
      type: String,
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    nameSnapshot: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      default: '',
    },
    flavour: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: '',
    },
    hsn: {
      type: String,
      default: '21069099',
    },
    barcode: {
      type: String,
      default: '',
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    mrpPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    priceOverridden: {
      type: Boolean,
      default: false,
    },
    lineDiscountPaise: {
      type: Number,
      default: 0,
    },
    billDiscountSharePaise: {
      type: Number,
      default: 0,
    },
    netPaise: {
      type: Number,
      required: true,
    },
    taxablePaise: {
      type: Number,
      required: true,
    },
    cgstPaise: {
      type: Number,
      default: 0,
    },
    sgstPaise: {
      type: Number,
      default: 0,
    },
    igstPaise: {
      type: Number,
      default: 0,
    },
    gstRate: {
      type: Number,
      required: true,
    },
    allocations: [billAllocationSchema],
    costTotalPaise: {
      type: Number,
      required: true,
      default: 0,
    },
    returnedQty: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const billSchema = new mongoose.Schema(
  {
    billNo: {
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
    status: {
      type: String,
      enum: ['completed', 'voided', 'partially_returned', 'returned'],
      default: 'completed',
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    customerSnapshot: {
      name: { type: String, default: 'Walk-in Customer' },
      phone: { type: String, default: '' },
      gstin: { type: String, default: '' },
      state: { type: String, default: 'Maharashtra' },
    },
    gstType: {
      type: String,
      enum: ['intra', 'inter'],
      default: 'intra',
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    staffNameSnapshot: {
      type: String,
      required: true,
    },
    items: [billItemSchema],
    subtotalPaise: {
      type: Number,
      required: true,
    },
    lineDiscountTotalPaise: {
      type: Number,
      default: 0,
    },
    billDiscountPaise: {
      type: Number,
      default: 0,
    },
    taxablePaise: {
      type: Number,
      required: true,
    },
    cgstPaise: {
      type: Number,
      default: 0,
    },
    sgstPaise: {
      type: Number,
      default: 0,
    },
    igstPaise: {
      type: Number,
      default: 0,
    },
    roundOffPaise: {
      type: Number,
      default: 0,
    },
    grandTotalPaise: {
      type: Number,
      required: true,
    },
    savingsPaise: {
      type: Number,
      default: 0,
    },
    paidPaise: {
      type: Number,
      default: 0,
    },
    duePaise: {
      type: Number,
      default: 0,
    },
    paymentSummary: [
      {
        mode: { type: String, required: true },
        amountPaise: { type: Number, required: true },
      },
    ],
    profitPaise: {
      type: Number,
      default: 0,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

export const Bill = mongoose.models.Bill || mongoose.model('Bill', billSchema);
