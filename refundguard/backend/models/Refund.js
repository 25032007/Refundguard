const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    refundId: { type: String, required: true, unique: true, index: true },
    transactionId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: [
        'item_not_received',
        'damaged_item',
        'wrong_item',
        'quality_issue',
        'duplicate_payment',
        'other',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'processed', 'rejected'],
      default: 'requested',
      index: true,
    },
    requestedAt: { type: Date, required: true },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

refundSchema.index({ customerId: 1, requestedAt: -1 });

module.exports = mongoose.model('Refund', refundSchema);