import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";
import type { Request } from "express";


export const pinohttp = pinoHttp({
	logger,

	genReqId: (req:Request, res) => {
		const id = randomUUID();

		res.setHeader("X-Request-Id", id);

		return id;
	},

	customProps: (req:Request) => ({
		requestId: req.id,
		userId: req.user?.userId ?? null
	})
});