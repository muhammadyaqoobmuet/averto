import Redis from "ioredis";
import { logger } from "../utils/logger";


export const redisLogs = logger.child({ name: "redis" })

let redisConnection: Redis | null = null
export function getRedis() {
	if (redisConnection) return redisConnection
	redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
	redisConnection.on("close", () => {
		redisLogs.info("Redis connection closed")

	})
	redisConnection.on("error", () => {
		redisLogs.error("Redis connection error")

	})
	redisConnection.on("connect", () => {
		redisLogs.info("Redis connection established")

	})
	return redisConnection
}