import jwt from 'jsonwebtoken';
import RefreshToken from '../models/RefreshToken.js';

export function signAccess(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

export async function signRefresh(user) {
  const ttl = process.env.JWT_REFRESH_EXPIRES || '30d';
  const token = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: ttl });
  // compute expiry date
  const { exp } = jwt.decode(token);
  const expiresAt = new Date(exp * 1000);
  await RefreshToken.create({ user: user.id, token, expiresAt });
  return token;
}

export async function revokeRefresh(token) {
  await RefreshToken.updateOne({ token }, { $set: { revokedAt: new Date() } });
}

export async function verifyRefresh(token) {
  const doc = await RefreshToken.findOne({ token, revokedAt: { $exists: false } });
  if (!doc) throw new Error('Invalid refresh token');
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  return doc;
}
