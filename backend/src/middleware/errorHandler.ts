import { DatabaseError, UniqueConstraintError, ValidationError } from 'sequelize';
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({ message: 'A record with those details already exists' });
  }
  if (err instanceof ValidationError || (err instanceof DatabaseError && (err.parent as { code?: string }).code === '22P02')) {
    return res.status(400).json({ message: 'Invalid record details' });
  }
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    return res.status(400).json({ message: 'Invalid request body' });
  }
  console.error('Request failed:', err.name);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
  });
}; 