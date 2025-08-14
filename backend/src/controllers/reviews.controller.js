import Joi from 'joi';
import Review from '../models/Review.js';
import { getPagination } from '../utils/pagination.js';

export async function getReviews(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const query = { movieId: Number(req.params.movieId) };
  const [items, total] = await Promise.all([
    Review.find(query).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    Review.countDocuments(query)
  ]);
  res.json({ page, limit, total, items: items.map(r => ({ ...r, id: r._id.toString(), _id: undefined })) });
}

export async function addReview(req, res) {
  const schema = Joi.object({
    movieId: Joi.number().required(),
    rating: Joi.number().min(0).max(10).required(),
    comment: Joi.string().allow('').default('')
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const review = await Review.create({
    ...value,
    userId: req.user.sub,
    username: req.user.username
  });
  res.status(201).json({ message: 'Review created', review: review.toJSON() });
}

export async function deleteReview(req, res) {
  const review = await Review.findById(req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  const isOwner = review.userId.toString() === req.user.sub;
  const isMod = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isMod) return res.status(403).json({ error: 'Forbidden' });
  await review.deleteOne();
  res.json({ message: 'Review deleted' });
}
