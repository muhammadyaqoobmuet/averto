export const HttpStatusCode = {
	// 2xx - Success
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	SERVICE_UNAVAILABLE: 503,
	NOT_IMPLEMENTED: 501,
	DATABASE_ERROR: 500,
	EXTERNAL_SERVICE_ERROR: 502,
	RATE_LIMIT_EXCEEDED: 429,

	// 4xx - Client errors
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,

	TOO_MANY_REQUESTS: 429,

	// 5xx - Server errors
	INTERNAL_SERVER_ERROR: 500,

} as const


export const ErrorCode = {
	// ---- Generic / cross-cutting ----
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_INPUT: "INVALID_INPUT",
	RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
	RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
	DATABASE_ERROR: "DATABASE_ERROR",
	EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
	NOT_IMPLEMENTED: "NOT_IMPLEMENTED",

	// ---- Auth service ----
	AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
	AUTH_EMAIL_ALREADY_REGISTERED: "AUTH_EMAIL_ALREADY_REGISTERED",
	AUTH_ACCESS_TOKEN_MISSING: "AUTH_ACCESS_TOKEN_MISSING",
	AUTH_ACCESS_TOKEN_INVALID: "AUTH_ACCESS_TOKEN_INVALID",
	AUTH_ACCESS_TOKEN_EXPIRED: "AUTH_ACCESS_TOKEN_EXPIRED",
	AUTH_REFRESH_TOKEN_INVALID: "AUTH_REFRESH_TOKEN_INVALID",
	AUTH_REFRESH_TOKEN_EXPIRED: "AUTH_REFRESH_TOKEN_EXPIRED",
	AUTH_REFRESH_TOKEN_REUSED: "AUTH_REFRESH_TOKEN_REUSED",
	AUTH_SESSION_NOT_FOUND: "AUTH_SESSION_NOT_FOUND",
	AUTH_FORBIDDEN: "AUTH_FORBIDDEN",

	// ---- User ----
	USER_NOT_FOUND: "USER_NOT_FOUND",

	// ---- Organization ----
	ORG_NOT_FOUND: "ORG_NOT_FOUND",
	ORG_SLUG_TAKEN: "ORG_SLUG_TAKEN",
	ORG_ACCESS_DENIED: "ORG_ACCESS_DENIED",

	// ---- Chatbot ----
	CHATBOT_NOT_FOUND: "CHATBOT_NOT_FOUND",
	CHATBOT_INVALID_URL: "CHATBOT_INVALID_URL",
	CHATBOT_PAGE_LIMIT_REACHED: "CHATBOT_PAGE_LIMIT_REACHED",
	CHATBOT_NOT_READY: "CHATBOT_NOT_READY",
	CHATBOT_API_KEY_INVALID: "CHATBOT_API_KEY_INVALID",
	CHATBOT_DOMAIN_NOT_ALLOWED: "CHATBOT_DOMAIN_NOT_ALLOWED",

	// ---- Crawl ----
	CRAWL_JOB_FAILED: "CRAWL_JOB_FAILED",
	CRAWL_JOB_TIMEOUT: "CRAWL_JOB_TIMEOUT",
	CRAWL_BLOCKED_BY_BOT_PROTECTION: "CRAWL_BLOCKED_BY_BOT_PROTECTION",
	CRAWL_NO_PAGES_FOUND: "CRAWL_NO_PAGES_FOUND",

	// ---- Chunk / embedding / RAG ----
	CHUNK_EMBEDDING_FAILED: "CHUNK_EMBEDDING_FAILED",
	CHUNK_NOT_FOUND: "CHUNK_NOT_FOUND",
	VECTOR_SEARCH_FAILED: "VECTOR_SEARCH_FAILED",

	// ---- Conversation / chat ----
	CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
	MESSAGE_GENERATION_FAILED: "MESSAGE_GENERATION_FAILED",
} as const;


export type ErrrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];
export type HttpStatusCodeType = typeof HttpStatusCode[keyof typeof HttpStatusCode];



export class AppError extends Error {
	public statusCode: HttpStatusCodeType;
	public errorCode: ErrrorCodeType;
	public message: string

	constructor(message: string, statusCode: HttpStatusCodeType, errorCode: ErrrorCodeType) {
		super(message);
		this.statusCode = statusCode;
		this.errorCode = errorCode;
		this.message = message;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class BadRequestError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.BAD_REQUEST, errorCode);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.UNAUTHORIZED, errorCode);
	}
}

export class ForbiddenError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.FORBIDDEN, errorCode);
	}
}

export class NotFoundError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.NOT_FOUND, errorCode);
	}
}

export class InternalServerError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.INTERNAL_SERVER_ERROR, errorCode);
	}
}

export class ServiceUnavailableError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.SERVICE_UNAVAILABLE, errorCode);
	}
}

export class DatabaseError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.DATABASE_ERROR, errorCode);
	}
}

export class ExternalServiceError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.EXTERNAL_SERVICE_ERROR, errorCode);
	}
}

export class NotImplementedError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.NOT_IMPLEMENTED, errorCode);
	}
}

export class RateLimitExceededError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.RATE_LIMIT_EXCEEDED, errorCode);
	}
}

export class ValidationError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.BAD_REQUEST, errorCode);
	}
}

export class InvalidInputError extends AppError {
	constructor(message: string, errorCode: ErrrorCodeType) {
		super(message, HttpStatusCode.BAD_REQUEST, errorCode);
	}
}
