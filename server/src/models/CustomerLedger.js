import mongoose from 'mongoose';

const customerLedgerSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['opening', 'bill_due', 'due_payment', 'return_adjust', 'bill_void', 'bill_edit'],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true, // positive increases due, negative decreases due
    },
    balanceAfterPaise: {
      type: Number,
      required: true,
    },
    refType: {
      type: String,
      enum: ['opening', 'bill', 'payment', 'return'],
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    note: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

// Immutable schema level guard
customerLedgerSchema.pre('updateOne', function () {
  throw new Error('CustomerLedger is immutable and cannot be updated');
});
customerLedgerSchema.pre('findOneAndUpdate', function () {
  throw new Error('CustomerLedger is immutable and cannot be updated');
});
customerLedgerSchema.pre('deleteOne', function () {
  throw new Error('CustomerLedger is immutable and cannot be deleted');
});
customerLedgerSchema.pre('findOneAndDelete', function () {
  throw new Error('CustomerLedger is immutable and cannot be deleted');
});

export const CustomerLedger =
  mongoose.models.CustomerLedger || mongoose.model('CustomerLedger', customerLedgerSchema);
