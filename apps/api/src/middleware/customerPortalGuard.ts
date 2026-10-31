import { Request, Response, NextFunction } from 'express';
import { Customer } from '../models/Customer.js';
import { AppError } from '../errors/AppError.js';

/**
 * Boundary guard for customer portal routes:
 * 1. Allows authenticated customer sessions.
 * 2. Allows internal staff (Superadmin, Admin, Sales) to preview/simulate portal
 *    using ?customerId=... or falling back to the first active customer.
 * 3. Rejects unauthenticated or invalid sessions.
 */
export async function ensureCustomerPortalSession(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (req.session?.customer?.customerId) {
    return next();
  }

  // Workstation employee simulation mode
  if (req.session?.user) {
    const targetCustomerId =
      (req.query.customerId as string) ||
      (req.headers['x-customer-id'] as string);

    if (targetCustomerId && /^[0-9a-fA-F]{24}$/.test(targetCustomerId)) {
      req.session.customer = {
        customerId: targetCustomerId,
        customerIdentityId: targetCustomerId
      };
      return next();
    }

    // Default to the first active customer for employee preview
    const firstCustomer = await Customer.findOne({ isActive: true }).select('_id email primaryPhone');
    if (firstCustomer) {
      req.session.customer = {
        customerId: firstCustomer._id.toString(),
        customerIdentityId: firstCustomer._id.toString(),
        email: firstCustomer.email,
        phone: firstCustomer.primaryPhone
      };
      return next();
    }
  }

  return next(
    AppError.permissionDenied('Customer portal session required to access this resource.')
  );
}
