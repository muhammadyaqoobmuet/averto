import pino from "pino";


const isDev = process.env.NODE_ENV === "development"

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "*token*",
            "*password*",
            "*secret*",
            "*key*",
            "*auth*",
            "*credential*",
        ],
        censor: "[REDACTED]"
    },
    base: {
        service: "express-backend"
    },
    transport: {
        targets: [
            ...(isDev ? [
                {
                    target: "pino-pretty",
                    options: {
                        colorize: true,
                        translateTime: "SYS:standard",
                        ignore: "hostname,pid",
                        singleLine: true,
                    },
                    level: process.env.LOG_LEVEL || "debug",
                }
            ] : []),
            ...(!isDev ? [
                {
                    target: "pino/file",
                    options: { destination: 1 }, // 1 = process.stdout
                    level: process.env.LOG_LEVEL || "info",
                },
            ] : [])
        ]
    }


})