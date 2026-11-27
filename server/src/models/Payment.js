import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    mode: {
      type: String,
      enum: ['cash', 'upi', 'card'],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
    },
    refNo: {
      type: String,
      trim: true,
      default: '',
    },
    cashTenderedPaise: {
      type: Number,
      default: null,
    },
    type: {
      type: String,
      default: 'sale',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
