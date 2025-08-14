import { Router } from 'express';
import { getMovieById, getTvById, getPopularMoviesCtrl, getPopularTvCtrl } from '../controllers/movies.controller.js';

const router = Router();

router.get('/popular', getPopularMoviesCtrl);
router.get('/tv/popular', getPopularTvCtrl);
router.get('/:id', getMovieById);
router.get('/tv/:id', getTvById);

export default router;
