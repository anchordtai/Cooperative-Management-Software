import { Request, Response, NextFunction } from 'express';
import Cooperative from '../models/Cooperative';
import { AppError } from '../middleware/errorHandler';

const defaults = { email: '', phone: '', address: '', currency: 'NGN' };

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cooperative = await Cooperative.findByPk(req.user!.cooperativeId);
    if (!cooperative) throw new AppError('Cooperative not found', 404);
    res.json({ ...defaults, ...cooperative.settings, cooperativeName: cooperative.name });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cooperativeName, email, phone, address } = req.body;
    if (typeof cooperativeName !== 'string' || !cooperativeName.trim() || cooperativeName.length > 160 ||
      ![email, phone, address].every(value => typeof value === 'string' && value.length <= 500)) {
      throw new AppError('Enter valid cooperative contact details', 400);
    }
    const cooperative = await Cooperative.findByPk(req.user!.cooperativeId);
    if (!cooperative) throw new AppError('Cooperative not found', 404);
    await cooperative.update({
      name: cooperativeName.trim(), settings: { ...cooperative.settings, email, phone, address }
    });
    res.json({ message: 'Settings updated', data: { ...defaults, ...cooperative.settings, cooperativeName: cooperative.name } });
  } catch (error) {
    next(error);
  }
};
