import mongoose from 'mongoose';

const PreferencesSchema = new mongoose.Schema({
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  emailNotifications: { type: Boolean, default: true },
  pushNotifications: { type: Boolean, default: true },
  language: { type: String, default: 'en' }
}, { _id: false });

const StatsSchema = new mongoose.Schema({
  totalReviews: { type: Number, default: 0 },
  totalLikes: { type: Number, default: 0 },
  moviesWatched: { type: Number, default: 0 }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2 },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  avatar: { type: String, default: '' },
  isEmailVerified: { type: Boolean, default: false },
  preferences: { type: PreferencesSchema, default: () => ({}) },
  badges: { type: [String], default: [] },
  stats: { type: StatsSchema, default: () => ({}) }
}, { timestamps: true });

UserSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  }
});

export default mongoose.model('User', UserSchema);
