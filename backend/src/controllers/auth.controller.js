import bcrypt from "bcryptjs";
import createError from "http-errors";
import Joi from "joi";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import {
  signAccess,
  signRefresh,
  revokeRefresh,
  verifyRefresh,
} from "../services/token.service.js";

const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
});

const registerSchema = Joi.object({
  body: Joi.object({
    username: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.ref("password"),
  }),
});

export async function register(req, res, next) {
  try {
    const { error } = registerSchema.validate({ body: req.body });
    if (error) throw createError(400, error.message);

    const { username, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) throw createError(409, "Email already registered");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash });

    const userObj = user.toJSON();
    userObj.id = userObj.id || userObj._id?.toString();
    const accessToken = signAccess(userObj);
    const refreshToken = await signRefresh(userObj);

    res.status(201).json({ user: userObj, accessToken, refreshToken });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { error } = loginSchema.validate({ body: req.body });
    if (error) throw createError(400, error.message);

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw createError(401, "Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw createError(401, "Invalid credentials");

    const userObj = user.toJSON();
    userObj.id = userObj.id || userObj._id?.toString();
    const accessToken = signAccess(userObj);
    const refreshToken = await signRefresh(userObj);

    res.json({ user: userObj, accessToken, refreshToken });
  } catch (e) {
    next(e);
  }
}

export async function profile(req, res) {
  res.json(req.userDoc ?? { id: req.user.sub });
}

export async function logout(req, res, next) {
  try {
    // Accept refresh token in Authorization or body for convenience
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : req.body?.refreshToken || null;
    if (token) await revokeRefresh(token);
    res.json({ message: "Logged out" });
  } catch (e) {
    next(e);
  }
}

// (Optional) refresh endpoint if you want it later
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw createError(400, "Missing refresh token");
    const doc = await verifyRefresh(refreshToken);
    const user = await User.findById(doc.user);
    const accessToken = signAccess(user.toJSON());
    res.json({ accessToken });
  } catch (e) {
    next(e);
  }
}
