import path from "path";
import fs from "fs";

import winston from "winston";

import config from "../config/config.js";

const logDir = path.resolve(process.cwd(), config.logDir);
fs.mkdirSync(logDir, { recursive: true });

const level = config.logLevel;

const enumerateErrorFormat = winston.format(info => {
    if (info.message instanceof Error) {
        info.message = Object.assign(
            {
                message: info.message.message,
                stack: info.message.stack
            },
            info.message
        );
    }

    if (info instanceof Error) {
        return Object.assign(
            {
                message: info.message,
                stack: info.stack
            },
            info
        );
    }

    return info;
});

function printfTemplate(info) {
    let log = `[${info.timestamp}] - ${info.service} - ${info.level}: ${info.message}`;
    if (info.stack) log += `\n${info.stack}`;
    return log;
}

const currentDate = new Date().toISOString().split("T")[0],
    logFileName = `${level}_${currentDate}.log`;

const logger = winston.createLogger({
    level,
    defaultMeta: {
        service: "puppeteer-screenshot"
    },

    format: enumerateErrorFormat(),

    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp({
                    format: "YYYY-MM-DD HH:mm:ss"
                }),
                winston.format.colorize(),
                winston.format.printf(printfTemplate)
            )
        }),

        new winston.transports.File({
            filename: path.join(logDir, logFileName),
            format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
    ]
});

logger.stream = {
    write: message => logger.info(message.trim())
};

export default logger;
