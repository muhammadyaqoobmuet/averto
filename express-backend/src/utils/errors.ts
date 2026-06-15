import { Request, Response, NextFunction } from 'express';
// TODO: CHANGE THIS SHIT
export class AppError extends Error {
    public status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    console.error(`[Error] ${req.method} ${req.url}:`, err);

    res.status(status).json({
        success: false,
        error: message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
