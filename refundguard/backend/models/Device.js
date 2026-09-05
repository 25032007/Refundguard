const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    deviceType: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet'],
      required: true,
    },
    os: { type: String, required: true },
    browser: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true }
);

deviceSchema.index({ deviceId: 1, customerId: 1 });

module.exports = mongoose.model('Device', deviceSchema);