import { Router } from 'express';
import { login, register, profile, logout, refresh } from '../controllers/auth.controller.js';
import { requireAuth, attachUser } from '../middlewares/auth.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', requireAuth, logout);
router.get('/profile', requireAuth, attachUser, profile);

// optional refresh token route (not in contract but handy)
// router.post('/refresh', refresh);

export default router;
