import mongoose from 'mongoose';

const WatchlistItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  id: { type: Number, required: true }, // TMDB id
  type: { type: String, enum: ['movie', 'tv'], required: true },
  title: String,
  name: String,
  poster_path: String,
  release_date: String,
  first_air_date: String,
  vote_average: Number,
  overview: String,
  dateAdded: { type: String, default: () => new Date().toISOString().slice(0, 10) }
}, { timestamps: true });

WatchlistItemSchema.index({ userId: 1, id: 1, type: 1 }, { unique: true });

export default mongoose.model('WatchlistItem', WatchlistItemSchema);
