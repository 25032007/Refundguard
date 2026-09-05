const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'netbanking', 'wallet'],
      required: true,
    },
    deviceId: { type: String, index: true },
    ipAddress: { type: String, index: true },
    status: {
      type: String,
      enum: ['completed', 'failed', 'cancelled'],
      default: 'completed',
      index: true,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);