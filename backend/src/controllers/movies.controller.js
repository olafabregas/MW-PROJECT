import { getMovie, getTv, getPopularMovies, getPopularTv } from '../services/tmdb.service.js';

export async function getMovieById(req, res, next) {
  try {
    const data = await getMovie(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
}
export async function getTvById(req, res, next) {
  try {
    const data = await getTv(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
}
export async function getPopularMoviesCtrl(req, res, next) {
  try {
    const data = await getPopularMovies(+req.query.page || 1);
    res.json(data);
  } catch (e) { next(e); }
}
export async function getPopularTvCtrl(req, res, next) {
  try {
    const data = await getPopularTv(+req.query.page || 1);
    res.json(data);
  } catch (e) { next(e); }
}
