import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  movieId: { type: Number, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String, required: true },
  rating: { type: Number, min: 0, max: 10, required: true },
  comment: { type: String, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false } });

ReviewSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    delete ret._id; delete ret.__v;
    ret.createdAt = ret.createdAt?.toISOString?.();
    return ret;
  }
});

export default mongoose.model('Review', ReviewSchema);
