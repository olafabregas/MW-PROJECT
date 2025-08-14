import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { getWatchlist, addToWatchlist, deleteWatchlistItem, clearWatchlist } from '../controllers/watchlist.controller.js';

const router = Router();

router.get('/', requireAuth, getWatchlist);
router.post('/', requireAuth, addToWatchlist);
router.delete('/:id', requireAuth, deleteWatchlistItem);
router.delete('/', requireAuth, clearWatchlist);

export default router;
