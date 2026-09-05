const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    refundId: { type: String, index: true },
    text: { type: String, required: true },
    category: {
      type: String,
      enum: ['delivery', 'product', 'payment', 'refund', 'other'],
      default: 'other',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'escalated'],
      default: 'open',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);