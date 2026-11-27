import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema(
  {
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
    flavour: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: '',
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
    gstRate: {
      type: Number,
      required: true,
      min: 0,
    },
    batchNo: {
      type: String,
      required: true,
      trim: true,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockBatch',
    },
    lineTaxablePaise: {
      type: Number,
      required: true,
    },
    lineGstPaise: {
      type: Number,
      required: true,
    },
    lineTotalPaise: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    supplierInvoiceNo: {
      type: String,
      required: true,
      trim: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    items: [purchaseItemSchema],
    subtotalPaise: {
      type: Number,
      required: true,
    },
    gstPaise: {
      type: Number,
      required: true,
    },
    totalPaise: {
      type: Number,
      required: true,
    },
    paidPaise: {
      type: Number,
      default: 0,
      required: true,
    },
    duePaise: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'partial', 'unpaid'],
      default: 'unpaid',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'voided'],
      default: 'active',
      index: true,
    },
    voidReason: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

export const Purchase = mongoose.models.Purchase || mongoose.model('Purchase', purchaseSchema);
