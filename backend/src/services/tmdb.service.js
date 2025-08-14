import axios from 'axios';

const baseURL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const client = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
  params: { api_key: process.env.TMDB_API_KEY }
});

export async function getMovie(id) {
  const { data } = await client.get(`/movie/${id}`);
  return data;
}

export async function getTv(id) {
  const { data } = await client.get(`/tv/${id}`);
  return data;
}

export async function getPopularMovies(page = 1) {
  const { data } = await client.get('/movie/popular', { params: { page } });
  return data;
}

export async function getPopularTv(page = 1) {
  const { data } = await client.get('/tv/popular', { params: { page } });
  return data;
}
