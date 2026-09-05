/**
 * Handles the GET /api/v1/health request.
 */
exports.getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    project: 'RefundGuard',
  });
};