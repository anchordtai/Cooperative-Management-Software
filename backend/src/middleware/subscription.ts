import { RequestHandler } from 'express';
import { AppError } from './errorHandler';
import { currentTerm, hasSubscriptionAccess, subscriptionEnforced } from '../services/subscriptions';

export const requireSubscription: RequestHandler = async (req, _res, next) => {
  try {
    if (subscriptionEnforced() && (!req.user || !hasSubscriptionAccess(await currentTerm(req.user.cooperativeId)))) {
      throw new AppError('Activate a subscription or authorised trial in Billing.', 402);
    }
    next();
  } catch (error) {
    next(error);
  }
};
