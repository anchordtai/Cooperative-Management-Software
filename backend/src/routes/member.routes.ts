import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
} from '../controllers/member.controller';

const router = express.Router();

router.get('/', authenticate, getAllMembers);
router.get('/:id', authenticate, getMemberById);
router.post('/', authenticate, createMember);
router.put('/:id', authenticate, updateMember);
router.delete('/:id', authenticate, deleteMember);

export default router;