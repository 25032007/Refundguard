const { z } = require('zod');
const crypto = require('crypto');

const decisionSchema = z.object({
  decision: z.enum(['UNREVIEWED', 'MONITOR', 'ESCALATED', 'CLEARED'], {
    errorMap: () => ({ message: 'Invalid decision type' }),
  }),
  reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional().nullable(),
  expectedVersion: z.number().int().nonnegative().optional(),
}).superRefine((data, ctx) => {
  if ((data.decision === 'ESCALATED' || data.decision === 'CLEARED') && (!data.reason || data.reason.trim().length < 5)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${data.decision} requires a reason of at least 5 characters`,
      path: ['reason'],
    });
  }
});

function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body || {});
      next();
    } catch (err) {
      if (err instanceof z.ZodError || (err && err.issues)) {
        const issues = err.issues || err.errors || [];
        return res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: issues.map((e) => `${e.path ? e.path.join('.') : 'body'}: ${e.message}`).join('; '),
            details: issues,
          },
          requestId: crypto.randomUUID(),
        });
      }
      next(err);
    }
  };
}

module.exports = {
  decisionSchema,
  validateBody,
};
