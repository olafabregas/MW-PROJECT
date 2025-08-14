import Joi from "joi";
import multer from "multer";
import path from "path";
import User from "../models/User.js";
import mongoose from "mongoose";

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) =>
      cb(null, process.env.UPLOAD_DIR || "uploads"),
    filename: (req, file, cb) =>
      cb(
        null,
        `${req.user.sub}-${Date.now()}${path.extname(file.originalname)}`
      ),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});

export async function listProfiles(req, res) {
  const users = await User.find().select("-passwordHash").lean();
  res.json(users.map((u) => ({ ...u, id: u._id.toString(), _id: undefined })));
}

export async function updateProfile(req, res) {
  const schema = Joi.object({
    username: Joi.string().min(2),
    role: Joi.string().valid("user", "moderator", "admin"),
    preferences: Joi.object({
      theme: Joi.string().valid("light", "dark"),
      emailNotifications: Joi.boolean(),
      pushNotifications: Joi.boolean(),
      language: Joi.string(),
    }),
    badges: Joi.array().items(Joi.string()),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  // only allow self-update unless admin
  const isSelf = req.params.id === req.user.sub;
  const isAdmin = req.user.role === "admin";
  if (!isSelf && !isAdmin) return res.status(403).json({ error: "Forbidden" });

  const user = await User.findByIdAndUpdate(req.params.id, value, {
    new: true,
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user.toJSON());
}

export async function uploadPicture(req, res) {
  if (!req.file)
    return res.status(400).json({ error: "profilePicture is required" });
  const relativeUrl = `/uploads/${req.file.filename}`;
  const isSelf = req.params.id === req.user.sub;
  const isAdmin = req.user.role === "admin";
  if (!isSelf && !isAdmin) return res.status(403).json({ error: "Forbidden" });
  await User.findByIdAndUpdate(req.params.id, { avatar: relativeUrl });
  res.json({ message: "Uploaded", profilePicture: relativeUrl });
}

// Health check endpoint for MongoDB connection
export async function mongoHealthCheck(req, res) {
  const state = mongoose.connection.readyState;
  let status = "disconnected";
  if (state === 1) status = "connected";
  else if (state === 2) status = "connecting";
  else if (state === 3) status = "disconnecting";
  res.json({
    mongoStatus: status,
    host: mongoose.connection.host,
    db: mongoose.connection.name,
    time: new Date().toISOString(),
  });
}
