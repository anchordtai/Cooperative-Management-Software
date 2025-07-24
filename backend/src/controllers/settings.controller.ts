import { Request, Response, NextFunction } from 'express';

// For now, we'll use a simple in-memory settings object
// In a real application, you'd want a Settings model/table
let appSettings = {
  id: 1,
  cooperativeName: 'E-Cooperative Management System',
  email: 'admin@cooperative.com',
  phone: '+1234567890',
  address: '123 Cooperative Street',
  currency: 'USD',
  interestRate: 5.0,
  minimumSavings: 100.0,
  enableNotifications: true,
  enableAutoApproval: false,
  enableTwoFactor: true,
};

export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(appSettings);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      cooperativeName,
      email,
      phone,
      address,
      currency,
      interestRate,
      minimumSavings,
      enableNotifications,
      enableAutoApproval,
      enableTwoFactor,
    } = req.body;
    
    // Update the settings object
    appSettings = {
      ...appSettings,
      cooperativeName: cooperativeName || appSettings.cooperativeName,
      email: email || appSettings.email,
      phone: phone || appSettings.phone,
      address: address || appSettings.address,
      currency: currency || appSettings.currency,
      interestRate: interestRate || appSettings.interestRate,
      minimumSavings: minimumSavings || appSettings.minimumSavings,
      enableNotifications: enableNotifications !== undefined ? enableNotifications : appSettings.enableNotifications,
      enableAutoApproval: enableAutoApproval !== undefined ? enableAutoApproval : appSettings.enableAutoApproval,
      enableTwoFactor: enableTwoFactor !== undefined ? enableTwoFactor : appSettings.enableTwoFactor,
    };
    
    res.json({ message: 'Settings updated successfully', data: appSettings });
  } catch (error) {
    next(error);
  }
};