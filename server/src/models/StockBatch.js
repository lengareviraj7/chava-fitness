import mongoose from 'mongoose';

const stockBatchSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
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
    qtyReceived: {
      type: Number,
      required: true,
      min: 0,
    },
    qtyLeft: {
      type: Number,
      required: true,
    },
    unitCostPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      required: false,
      index: true,
    },
  },
  { timestamps: true }
);

stockBatchSchema.index({ variantId: 1, batchNo: 1, expiryDate: 1 });
stockBatchSchema.index({ variantId: 1, expiryDate: 1 });

export const StockBatch = mongoose.models.StockBatch || mongoose.model('StockBatch', stockBatchSchema);
