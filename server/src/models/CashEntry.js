import mongoose from 'mongoose';

const cashEntrySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['cash_in', 'expense', 'bank_deposit', 'owner_draw'],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    note: {
      type: String,
      required: true,
      trim: true,
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

export const CashEntry = mongoose.models.CashEntry || mongoose.model('CashEntry', cashEntrySchema);
