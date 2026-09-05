const mongoose = require('mongoose');

const refundRingSchema = new mongoose.Schema(
  {
    ringId: { type: String, required: true, unique: true, index: true },
    customerIds: { type: [String], default: [], index: true },
    deviceIds: { type: [String], default: [] },
    ipAddresses: { type: [String], default: [] },
    transactionIds: { type: [String], default: [] },
    refundIds: { type: [String], default: [] },
    complaintIds: { type: [String], default: [] },
    riskScore: { type: Number, default: 0 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'under_review', 'confirmed', 'dismissed'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RefundRing', refundRingSchema);