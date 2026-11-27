import mongoose from 'mongoose';

const dayCloseSchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['active', 'superseded'],
      default: 'active',
      index: true,
    },
    openingCashPaise: {
      type: Number,
      required: true,
    },
    figures: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    expectedCashPaise: {
      type: Number,
      required: true,
    },
    countedCashPaise: {
      type: Number,
      required: true,
    },
    differencePaise: {
      type: Number,
      required: true, // counted - expected
    },
    denominations: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    note: {
      type: String,
      default: '',
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    closedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const DayClose = mongoose.models.DayClose || mongoose.model('DayClose', dayCloseSchema);
