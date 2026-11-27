import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { sendError } from '../utils/apiResponse.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return sendError(res, 'Authentication required. Please login.', 'UNAUTHORIZED', 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -pin');
    if (!user || !user.isActive) {
      return sendError(res, 'User session invalid or user deactivated.', 'UNAUTHORIZED', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token.', 'INVALID_TOKEN', 401);
  }
};

// Optional auth that identifies user if token is present, but lets guest through with role: 'staff' for safe catalog read
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -pin');
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (e) {
    // ignore token errors in optional auth
  }
  next();
};

export const requireOwner = (req, res, next) => {
  if (!req.user || req.user.role !== 'owner') {
    return sendError(res, 'Access denied. Owner privilege required.', 'FORBIDDEN', 403);
  }
  next();
};
