import { permit } from '../middleware/permissions';
import { Router } from 'express';
import { authenticate, restrictTo } from '../middleware/auth';
import {
  getAllMembers, getMemberById, getOwnMember, createMember, updateMember, deleteMember, inviteMember
} from '../controllers/member.controller';

const router = Router();
router.use(authenticate);
router.get('/my', getOwnMember);
router.get('/', permit('members.read'), getAllMembers);
router.get('/:id', permit('members.read'), getMemberById);
router.post('/', restrictTo('admin'), createMember);
router.put('/:id', restrictTo('admin'), updateMember);
router.delete('/:id', restrictTo('admin'), deleteMember);
router.post('/:id/invite', restrictTo('admin'), inviteMember);

export default router;
