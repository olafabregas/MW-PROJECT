import jwt from 'jsonwebtoken';
import createError from 'http-errors';
import User from '../models/User.js';

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw createError(401, 'Missing Authorization token');

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return next(createError(401, 'Invalid or expired token'));
  }
}

// attach full user (optional helper)
export async function attachUser(req, res, next) {
  if (!req.user?.sub) return next();
  const user = await User.findById(req.user.sub).lean();
  req.userDoc = user || null;
  next();
}
