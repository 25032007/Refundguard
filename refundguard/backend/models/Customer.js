const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'blocked', 'under_review'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Customer', customerSchema);