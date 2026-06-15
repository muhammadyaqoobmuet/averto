import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// AuthRequest is now just an alias for Request.
// req.user is globally typed via src/types/express.d.ts
export type AuthRequest = Request;

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = authHeader.substring(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
        req.user = { userId: payload.userId };
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
