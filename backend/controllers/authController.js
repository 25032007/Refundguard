const { generateToken } = require('../middleware/authMiddleware');

const USERS = [
  { id: 'analyst-1', email: 'analyst@refundguard.io', password: 'password123', name: 'Anjali Sharma', role: 'ANALYST' },
  { id: 'lead-1', email: 'lead@refundguard.io', password: 'password123', name: 'Vikram Mehta', role: 'LEAD' },
  { id: 'admin-1', email: 'admin@refundguard.io', password: 'password123', name: 'Security Admin', role: 'ADMIN' },
];

exports.login = (req, res) => {
  const { email, password, analystId } = req.body || {};

  let user;
  if (email) {
    user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  } else if (analystId) {
    user = USERS.find((u) => u.id === analystId) || {
      id: analystId,
      email: `${analystId}@refundguard.io`,
      name: `Analyst ${analystId}`,
      role: 'ANALYST',
    };
  }

  if (email && (!user || user.password !== password)) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
  }

  if (!user) {
    user = USERS[0];
  }

  const token = generateToken(user);
  return res.json({
    status: 'success',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
};

exports.getProfile = (req, res) => {
  res.json({
    status: 'success',
    user: req.user,
  });
};
