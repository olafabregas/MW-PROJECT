import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import xss from 'xss-clean';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import corsOptions from './config/cors.js';
import errorHandler from './middlewares/error.js';

import authRoutes from './routes/auth.routes.js';
import contactRoutes from './routes/contact.routes.js';
import moviesRoutes from './routes/movies.routes.js';
import profilesRoutes from './routes/profiles.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import watchlistRoutes from './routes/watchlist.routes.js';

const app = express();

app.use(cors(corsOptions));
app.use(helmet());
app.use(xss());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadsDir)));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/watchlist', watchlistRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// centralized error handler
app.use(errorHandler);

export default app;
