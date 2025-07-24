import express from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { authenticate, restrictTo } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, getSettings);
router.put('/', authenticate, restrictTo('admin'), updateSettings);

export default router; 