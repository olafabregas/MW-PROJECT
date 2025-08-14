import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { getReviews, addReview, deleteReview } from '../controllers/reviews.controller.js';

const router = Router();

router.get('/:movieId', getReviews);           // public
router.post('/', requireAuth, addReview);      // protected
router.delete('/:reviewId', requireAuth, deleteReview);

export default router;
