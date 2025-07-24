import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AppError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { sendEmail } from '../utils/email';
import crypto from 'crypto';

// In-memory 2FA code store (for demo; use Redis for production)
// const _twoFACodes: { [email: string]: string } = {};

// Placeholder for SMS sending utility
async function sendSMS(_phone: string, _message: string) {
  // Integrate with Twilio, Termii, etc.
  return Promise.resolve();
}

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, role = 'member', firstName, lastName, phone } = req.body;
    if (!email || !password || !phone) {
      return next(new AppError('Email, password, and phone are required', 400));
    }
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }
    // Generate verification tokens/codes
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const phoneVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Create new user (password will be automatically hashed by User model hooks)
    await User.create({
      email,
      password,
      role,
      firstName,
      lastName,
      phone,
      isEmailVerified: false,
      emailVerificationToken,
      isPhoneVerified: false,
      phoneVerificationCode
    });
    // Send verification email (handle errors gracefully)
    try {
      await sendEmail(
        email,
        'Verify your email',
        `Click the link to verify your email: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-account?token=${emailVerificationToken}`,
        `<p>Click the link to verify your email: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-account?token=${emailVerificationToken}">Verify Email</a></p>`
      );
      console.log('Verification email sent successfully to:', email);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }
    
    // Send verification SMS (handle errors gracefully)
    try {
      await sendSMS(phone, `Your verification code is: ${phoneVerificationCode}`);
      console.log('Verification SMS sent successfully to:', phone);
    } catch (smsError) {
      console.error('Failed to send verification SMS:', smsError);
    }
    
    console.log('User registered successfully:', email);
    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your email and phone number to continue.',
      data: {
        email,
        phone,
        firstName,
        lastName,
        requiresVerification: true,
        nextStep: 'verify-account'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    if (!token) return next(new AppError('Verification token is required', 400));
    const user = await User.findOne({ where: { emailVerificationToken: token } });
    if (!user) return next(new AppError('Invalid or expired token', 400));
    await user.update({ isEmailVerified: true, emailVerificationToken: null });
    res.json({ status: 'success', message: 'Email verified successfully.' });
  } catch (error) {
    next(error);
  }
};

export const verifyPhone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return next(new AppError('Phone and code are required', 400));
    const user = await User.findOne({ where: { phone, phoneVerificationCode: code } });
    if (!user) return next(new AppError('Invalid code or phone', 400));
    await user.update({ isPhoneVerified: true, phoneVerificationCode: null });
    res.json({ status: 'success', message: 'Phone number verified successfully.' });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('Login attempt:', req.body.email);
    const { email, password, twoFAMethod } = req.body;
    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('User not found:', email);
      return next(new AppError('Invalid credentials', 401));
    }
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password for:', email);
      return next(new AppError('Invalid credentials', 401));
    }
    // Require email and phone verification for production
    if (!user.isEmailVerified) {
      console.log('Email not verified for:', email);
      return res.status(403).json({ 
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        verificationType: 'email'
      });
    }
    if (!user.isPhoneVerified) {
      console.log('Phone not verified for:', email);
      return res.status(403).json({ 
        message: 'Please verify your phone number before logging in.',
        requiresVerification: true,
        verificationType: 'phone'
      });
    }
    
    // 2FA logic
    if (user.twoFAEnabled) {
      // Generate 2FA code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
      await user.update({ twoFACode: code, twoFACodeExpires: codeExpires });
      // Send code via preferred method
      const method = twoFAMethod || user.twoFAMethod || 'email';
      if (method === 'sms') {
        console.log('Sending 2FA code via SMS to:', user.phone);
        await sendSMS(user.phone, `Your 2FA code is: ${code}`);
      } else {
        console.log('Sending 2FA code via email to:', user.email);
        await sendEmail(
          user.email,
          'Your 2FA Code',
          `Your 2FA code is: ${code}`,
          `<p>Your 2FA code is: <b>${code}</b></p>`
        );
      }
      console.log('2FA required for:', email);
      return res.status(200).json({ require2FA: true, message: `2FA code sent via ${method}.`, twoFAMethod: method });
    }
    // If no 2FA, issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    console.log('Login successful for:', email);
    
    // Determine dashboard redirect based on role
    const dashboardRoute = user.role === 'admin' ? '/admin/dashboard' : '/dashboard';
    
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
        },
        redirectTo: dashboardRoute
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

export const verify2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, code } = req.body;
    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }
    // Check code and expiry
    if (!user.twoFACode || !user.twoFACodeExpires) {
      return res.status(400).json({ message: 'No 2FA code found. Please login again.' });
    }
    if (user.twoFACode !== code) {
      return res.status(400).json({ message: 'Invalid 2FA code.' });
    }
    if (new Date() > new Date(user.twoFACodeExpires)) {
      return res.status(400).json({ message: '2FA code expired. Please login again.' });
    }
    // Clear 2FA code
    await user.update({ twoFACode: null, twoFACodeExpires: null });
    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // TODO: Implement refresh token logic
    res.status(200).json({
      status: 'success',
      message: 'Token refresh not implemented yet',
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for token in Authorization header or cookies
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'firstName', 'lastName', 'phone']
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
};

export const resendEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError('Email is required', 400));
    const user = await User.findOne({ where: { email } });
    if (!user) return next(new AppError('User not found', 404));
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    await user.update({ emailVerificationToken });
    await sendEmail(
      email,
      'Verify your email',
      `Click the link to verify your email: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}`,
      `<p>Click the link to verify your email: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}">Verify Email</a></p>`
    );
    res.json({ status: 'success', message: 'Verification email resent.' });
  } catch (error) {
    next(error);
  }
};

export const resendSMS = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;
    if (!phone) return next(new AppError('Phone is required', 400));
    const user = await User.findOne({ where: { phone } });
    if (!user) return next(new AppError('User not found', 404));
    const phoneVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await user.update({ phoneVerificationCode });
    await sendSMS(phone, `Your verification code is: ${phoneVerificationCode}`);
    res.json({ status: 'success', message: 'Verification SMS resent.' });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.update({ passwordResetToken: token, passwordResetExpires: expires });
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    await sendEmail(
      email,
      'Password Reset',
      `Click the link to reset your password: ${resetUrl}`,
      `<p>Click the link to reset your password: <a href="${resetUrl}">Reset Password</a></p>`
    );
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return next(new AppError('Token and new password are required', 400));
    const user = await User.findOne({ 
      where: { 
        passwordResetToken: token,
        passwordResetExpires: {
          [require('sequelize').Op.gt]: new Date()
        }
      } 
    });
    if (!user) return next(new AppError('Invalid or expired token', 400));
    await user.update({ 
      password,
      passwordResetToken: null, 
      passwordResetExpires: null 
    });
    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    next(error);
  }
}; 