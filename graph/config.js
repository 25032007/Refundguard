/**
 * RefundGuard graph/ring-detection configuration.
 *
 * Every threshold, contribution budget, and label used by the graph engine
 * lives here so no magic numbers leak into the analysis modules.
 */

module.exports = {
  nodeTypes: {
    customer: 'customer',
    device: 'device',
    ip: 'ip',
    transaction: 'transaction',
    refund: 'refund',
    complaint: 'complaint',
  },

  edgeTypes: {
    customerTransaction: 'customer_transaction',
    transactionRefund: 'transaction_refund',
    customerComplaint: 'customer_complaint',
    transactionDevice: 'transaction_device',
    customerIp: 'customer_ip',
    customerDevice: 'customer_device',
    complaintRefund: 'complaint_refund',
  },

  relationshipTypes: {
    sharedIp: 'shared_ip',
    sharedDevice: 'shared_device',
    sharedTransactionContext: 'shared_transaction_context',
  },

  /**
   * A resource (IP/device/order) must be used by this many customers for a
   * customer-to-customer relationship edge to be created.
   */
  relationshipMinMembers: 2,

  /**
   * Whether two customers sharing an order ID should be linked by a
   * `shared_transaction_context` relationship.
   *
   * DISABLED by default: in the synthetic dataset, order IDs are drawn from a
   * shared pool with replacement, so same-order reuse between unrelated normal
   * customers is coincidental (120 accidental groups among the 64 normal
   * customers). Enabling it would merge normal customers into large connected
   * components and fabricate rings the data does not support.
   */
  includeSharedTransactionContext: false,

  /**
   * A connected component only becomes a ring candidate when it is meaningfully
   * interconnected:
   *   - at least `minimumMembers` customers, and
   *   - at least `minimumRelationshipEdges` typed relationship edges.
   */
  ringCandidate: {
    minimumMembers: 3,
    minimumRelationshipEdges: 2,
  },

  scoring: {
    maxScore: 100,
    sharedIp: 25,
    sharedDevice: 25,
    density: 15,
    refundConcentration: 15,
    multiMemberRefundActivity: 10,
    complaintConcentration: 10,

    /**
     * Shared-IP/device contributions are scaled by member count so a small
     * ring of 3 members does not hit the full budget: the factor is
     * min(memberCount / sizeFactorMaxMembers, 1).
     */
    sizeFactorMaxMembers: 5,

    /**
     * Refund-concentration score = 15 * clamp((ringRefundRate - baseline) /
     * (1 - baseline), 0, 1). A ring refunding at or below the baseline rate
     * earns ~0; a ring refunding every transaction earns the full 15.
     */
    refundRateBaseline: 0.3,
  },

  severity: [
    { max: 24, label: 'low' },
    { max: 49, label: 'medium' },
    { max: 74, label: 'high' },
    { max: 100, label: 'critical' },
  ],

  signalSeverity: [
    { maxShare: 0.25, label: 'low' },
    { maxShare: 0.5, label: 'medium' },
    { maxShare: 0.75, label: 'high' },
    { maxShare: 1, label: 'critical' },
  ],

  output: {
    topRings: 5,
  },
};