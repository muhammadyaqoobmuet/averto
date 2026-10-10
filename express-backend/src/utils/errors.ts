import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

const errorLogger = logger.child({ name: "error" });

/** Error type for anything the application deliberately throws. */
export class AppError extends Error {
  public status: number;
  public details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // 5xx means we broke; 4xx means the caller sent something wrong. Logging
  // every 400 at error level trains people to ignore the error log.
  if (status >= 500) {
    errorLogger.error(
      { err, method: req.method, url: req.url },
      `Unhandled error: ${message}`,
    );
  } else {
    errorLogger.warn(
      { status, method: req.method, url: req.url, message },
      "Request rejected",
    );
  }

  if (res.headersSent) return next(err);

  res.status(status).json({
    success: false,
    error: message,
    // Field-level validation details, when the middleware supplied them.
    ...(err.details ? { details: err.details } : {}),
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
};