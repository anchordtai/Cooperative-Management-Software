import { frontendUrl } from '../config/frontend';
import { brand } from '../config/brand';
import { Router } from 'express';
import sequelize from '../config/database';
import { authenticate, newToken, restrictTo, tokenHash } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { staffPermissions } from '../middleware/permissions';
import Session from '../models/Session';
import { User } from '../models/User';
import { recordAudit } from '../services/audit';
import { sendEmail } from '../utils/email';

const router = Router();
router.use(authenticate, restrictTo('admin'));
const fields = ['id', 'email', 'firstName', 'lastName', 'phone', 'permissions', 'isActive', 'isEmailVerified'];

function validatedPermissions(input: unknown): string[] {
  if (!Array.isArray(input) || !input.every(value => staffPermissions.includes(value))) {
    throw new AppError('Select valid staff permissions', 400);
  }
  const permissions = new Set<string>(input);
  const financialWrites = ['loans.submit', 'loans.decide', 'loans.post', 'savings.deposit', 'withdrawals.decide'];
  if (financialWrites.some(permission => permissions.has(permission)) && !permissions.has('finance.read')) {
    throw new AppError('Select View financial records before assigning financial write permissions', 400);
  }
  if ((permissions.has('loans.submit') || permissions.has('savings.deposit')) && !permissions.has('members.read')) {
    throw new AppError('Select View members before assigning loan submission or deposit permissions', 400);
  }
  return [...permissions];
}

router.get('/', async (req, res, next) => {
  try {
    const staff = await User.findAll({
      where: { cooperativeId: req.user!.cooperativeId, role: 'staff' }, attributes: fields,
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });
    res.json({ data: staff });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { cooperativeId, id } = req.user!;
    const { email, firstName, lastName, phone } = req.body;
    if (![email, firstName, lastName, phone].every(x => typeof x === 'string' && x.trim() && x.length <= 160)) {
      throw new AppError('Enter the staff member’s name, email and phone', 400);
    }
    const permissions = validatedPermissions(req.body.permissions);
    const token = newToken();
    const staff = await sequelize.transaction(async transaction => {
      const user = await User.create({
        cooperativeId, role: 'staff', email: email.trim().toLowerCase(), firstName: firstName.trim(),
        lastName: lastName.trim(), phone: phone.trim(), permissions, password: newToken(),
        emailVerificationToken: tokenHash(token), emailVerificationExpires: new Date(Date.now() + 86400000)
      }, { transaction });
      await recordAudit(transaction, cooperativeId, id, 'staff.invited', user.id, { permissions });
      return user;
    });
    const delivered = await deliverInvitation(staff.email, token);
    res.status(201).json({ data: { id: staff.id, delivered } });
  } catch (error) {
    next(error);
  }
});

async function deliverInvitation(email: string, token: string) {
  try {
    await sendEmail(email, `Activate your ${brand.name} staff account`, `${frontendUrl()}/verify-account#invite=${token}`);
    return true;
  } catch {
    return false;
  }
}

router.post('/:id/invite', async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, cooperativeId: req.user!.cooperativeId, role: 'staff', isActive: true, isEmailVerified: false }
    });
    if (!user) throw new AppError('Pending staff account not found', 404);
    const token = newToken();
    await user.update({ emailVerificationToken: tokenHash(token), emailVerificationExpires: new Date(Date.now() + 86400000) });
    const delivered = await deliverInvitation(user.email, token);
    res.json({ data: { delivered } });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { cooperativeId, id } = req.user!;
    const permissions = validatedPermissions(req.body.permissions);
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') throw new AppError('Select whether the staff account is active', 400);
    await sequelize.transaction(async transaction => {
      const staff = await User.findOne({
        where: { id: req.params.id, cooperativeId, role: 'staff' }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!staff) throw new AppError('Staff account not found', 404);
      await staff.update({ permissions, isActive }, { transaction });
      if (!isActive) await Session.destroy({ where: { userId: staff.id }, transaction });
      await recordAudit(transaction, cooperativeId, id, 'staff.permissions_updated', staff.id, { permissions, isActive });
    });
    res.json({ message: 'Staff account updated' });
  } catch (error) {
    next(error);
  }
});

export default router;
