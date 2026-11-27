import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockBatch',
      required: true,
      index: true,
    },
    qty: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['purchase', 'purchase_void', 'sale', 'sale_return', 'adjustment'],
      required: true,
    },
    reason: {
      type: String,
      enum: ['damaged', 'expired', 'lost', 'counting_correction', 'initial', 'void', 'sale', 'return', 'shortfall', 'other'],
      default: 'other',
    },
    refType: {
      type: String,
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

stockMovementSchema.index({ variantId: 1, createdAt: -1 });
stockMovementSchema.index({ refType: 1, refId: 1 });

// Prevent updates and deletions at schema level (Immutable Ledger)
stockMovementSchema.pre('updateOne', function () {
  throw new Error('StockMovement is immutable and cannot be updated');
});
stockMovementSchema.pre('findOneAndUpdate', function () {
  throw new Error('StockMovement is immutable and cannot be updated');
});
stockMovementSchema.pre('deleteOne', function () {
  throw new Error('StockMovement is immutable and cannot be deleted');
});
stockMovementSchema.pre('findOneAndDelete', function () {
  throw new Error('StockMovement is immutable and cannot be deleted');
});

export const StockMovement = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);
