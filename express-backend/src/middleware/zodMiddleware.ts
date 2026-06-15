import type { NextFunction, Request, Response } from "express";
import * as z from "zod";

export const zodMiddleware =
	<T extends z.ZodTypeAny>(schema: T) =>
		(req: Request, _res: Response, next: NextFunction) => {
			try {
				req.body = schema.parse(req.body);
				return next();
			} catch (error) {
				return next(error);
			}
		};