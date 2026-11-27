import mongoose from 'mongoose';

const supplierPaymentSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    mode: {
      type: String,
      enum: ['cash', 'upi', 'bank'],
      required: true,
    },
    refNo: {
      type: String,
      trim: true,
      default: '',
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const SupplierPayment = mongoose.models.SupplierPayment || mongoose.model('SupplierPayment', supplierPaymentSchema);
