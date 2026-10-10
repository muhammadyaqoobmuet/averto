import type { NextFunction, Request, Response } from "express";
import * as z from "zod";
import { logger } from "../utils/logger";

const validationLogger = logger.child({ name: "validation" });

/**
 * Validates (and coerces) `req.body` against a Zod schema.
 *
 * On failure the request is rejected with a 400 and a field-level message list
 * instead of a generic 500 from whatever blew up further down. Express 4 does
 * not forward rejected promises automatically, so the async validation is
 * wrapped and any error is handed to `next`.
 */
export const validate =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        validationLogger.warn(
          { issues: error.issues, path: req.originalUrl },
          "Request validation failed",
        );
        return next({
          status: 400,
          message: "Invalid request",
          details: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
      }
      return next(error);
    }
  };