import { Request, Response, NextFunction } from 'express';
import Member from '../models/Member';
import { AppError } from '../middleware/errorHandler';

export const getAllMembers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await Member.findAll();
    res.status(200).json({ status: 'success', results: members.length, data: members });
  } catch (error) {
    next(error);
  }
};

export const getMemberById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) return next(new AppError('Member not found', 404));
    res.status(200).json({ status: 'success', data: member });
  } catch (error) {
    next(error);
  }
};

export const createMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone, address, dateOfBirth, userId } = req.body;
    const member = await Member.create({
      firstName,
      lastName,
      phone,
      address,
      dateOfBirth,
      userId,
      status: 'active',
      shareCapital: 0,
      savings: 0
    });
    res.status(201).json({ status: 'success', data: member });
  } catch (error) {
    next(error);
  }
};

export const updateMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone, address, dateOfBirth, status } = req.body;
    const member = await Member.findByPk(req.params.id);
    if (!member) return next(new AppError('Member not found', 404));
    
    await member.update({
      firstName,
      lastName,
      phone,
      address,
      dateOfBirth,
      status
    });
    res.status(200).json({ status: 'success', data: member });
  } catch (error) {
    next(error);
  }
};

export const deleteMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) return next(new AppError('Member not found', 404));
    
    await member.destroy();
    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
}; 