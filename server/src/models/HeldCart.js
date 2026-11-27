import mongoose from 'mongoose';

const heldCartSchema = new mongoose.Schema(
  {
    holdCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    cart: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '7d' }, // Automatically cleans up abandoned held carts after 7 days
    },
  },
  { timestamps: true }
);

export const HeldCart = mongoose.models.HeldCart || mongoose.model('HeldCart', heldCartSchema);
