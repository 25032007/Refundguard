/**
 * Signal registry — indexes all six signal evaluators so the engine can invoke
 * them uniformly (and future signals can be added by dropping a file here).
 */

module.exports = {
  refundFrequency: require('./refundFrequency'),
  refundRate: require('./refundRate'),
  refundVelocity: require('./refundVelocity'),
  repeatedReason: require('./repeatedReason'),
  sharedIp: require('./sharedIp'),
  sharedDevice: require('./sharedDevice'),
};