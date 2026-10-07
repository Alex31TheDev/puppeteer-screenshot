import fs from "node:fs";
import path from "node:path";

import Schema from "./Schema.js";

import ConfigError from "../errors/ConfigError.js";

class Config {
    static schema = new Schema({
        logDir: { type: "path", default: "./logs" },
        logLevel: { type: "string", default: "info" },
        port: { type: "integer", min: 1, max: 65535, default: 3000 },
        bodyLimit: { type: "string", default: "32kb" },
        screenshotDir: { type: "path", default: "./screenshots" },
        userDataDir: { type: "path", default: "./cache" },
        usersPath: { type: "path", default: "./config/users.json" },
        headless: { type: "boolean", default: true },
        useNewNav: { type: "boolean", default: true },
        userAgent: { type: "string", optional: true },
        timezone: { type: "string", optional: true },
        window: {
            type: "object",
            schema: {
                fullscreen: { type: "boolean", default: false },
                width: { type: "integer", min: 1, max: 16384, default: 1920 },
                height: { type: "integer", min: 1, max: 16384, default: 1080 },
                zoom: { type: "number", min: 0.1, max: 4, default: 1 }
            }
        },
        args: {
            type: "array",
            itemType: "string",
            unique: true,
            default: ["--disable-gpu"]
        },
        navigationTimeout: { type: "integer", min: 1, default: 15000 },
        maxScreenshotBytes: { type: "integer", min: 1, max: 100 * 1024 * 1024, default: 20 * 1024 * 1024 },
        discordLoginTimeout: { type: "integer", min: 1, default: 30000 },
        discordMessageTimeout: { type: "integer", min: 1, default: 5000 },
        discordCrashCheckInterval: { type: "integer", min: 1, default: 5000 },
        allowPrivateNetwork: { type: "boolean", default: false },
        tokenTtl: { type: "string", default: "30d" },
        jwtIssuer: { type: "string", default: "puppeteer-screenshot" },
        jwtAudience: { type: "string", default: "puppeteer-screenshot" },
        loginWindowMs: { type: "integer", min: 1, default: 60000 },
        loginMaxAttempts: { type: "integer", min: 1, default: 10 }
    });

    static load(filePath) {
        const raw = Config._read(filePath),
            data = Config.schema.validate(raw);

        return new Config(data);
    }

    constructor(data = {}) {
        Object.assign(this, data);
        Object.freeze(this);
    }

    static _read(filePath) {
        let content;

        try {
            content = fs.readFileSync(filePath, "utf8");
        } catch (err) {
            throw new ConfigError(`Unable to read configuration at "${filePath}"`, { cause: err });
        }

        try {
            return JSON.parse(content);
        } catch (err) {
            throw new ConfigError(`Configuration at "${filePath}" is not valid JSON`, { cause: err });
        }
    }
}

const configPath = path.resolve(process.cwd(), "config/config.json"),
    config = Config.load(configPath);

export default config;
