/**
 * PII Masking utility functions for compliance and data privacy
 */

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return email;
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

export function maskName(name) {
  if (!name || typeof name !== 'string') return name;
  const words = name.split(' ');
  return words
    .map((w) => (w.length > 1 ? `${w[0]}${'*'.repeat(Math.min(w.length - 1, 4))}` : w))
    .join(' ');
}

export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '******';
  return `+${digits.slice(0, 2)} ******${digits.slice(-4)}`;
}

export function maskIP(ip) {
  if (!ip || typeof ip !== 'string') return ip;
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return ip;
}

export function formatPiiText(text, type = 'name', isMasked = false) {
  if (!isMasked || !text) return text;
  switch (type) {
    case 'email':
      return maskEmail(text);
    case 'phone':
      return maskPhone(text);
    case 'ip':
      return maskIP(text);
    case 'name':
    default:
      return maskName(text);
  }
}
