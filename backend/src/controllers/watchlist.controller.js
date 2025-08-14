import Joi from 'joi';
import WatchlistItem from '../models/WatchlistItem.js';
import { getPagination } from '../utils/pagination.js';

export async function getWatchlist(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const query = { userId: req.user.sub };
  const [items, total] = await Promise.all([
    WatchlistItem.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WatchlistItem.countDocuments(query)
  ]);
  res.json({ page, limit, total, items });
}

export async function addToWatchlist(req, res) {
  const schema = Joi.object({
    id: Joi.number().required(),
    type: Joi.string().valid('movie', 'tv').required(),
    title: Joi.string().allow(''),
    name: Joi.string().allow(''),
    poster_path: Joi.string().allow(''),
    release_date: Joi.string().allow(''),
    first_air_date: Joi.string().allow(''),
    vote_average: Joi.number().allow(null),
    overview: Joi.string().allow('')
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  try {
    const item = await WatchlistItem.create({ ...value, userId: req.user.sub });
    return res.status(201).json({ message: 'Added to watchlist', item });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Already in watchlist' });
    throw e;
  }
}

export async function deleteWatchlistItem(req, res) {
  const found = await WatchlistItem.findOneAndDelete({ userId: req.user.sub, id: Number(req.params.id) });
  if (!found) return res.status(404).json({ error: 'Item not found' });
  res.json({ message: 'Removed from watchlist' });
}

export async function clearWatchlist(req, res) {
  await WatchlistItem.deleteMany({ userId: req.user.sub });
  res.json({ message: 'Watchlist cleared' });
}
