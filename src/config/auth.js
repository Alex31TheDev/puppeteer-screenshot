import fs from "node:fs";
import path from "node:path";

import Schema from "./Schema.js";

import Util from "../util/Util.js";

import ConfigError from "../errors/ConfigError.js";

const authEnvKeys = Object.freeze({
    jwtSecret: "JWT_SECRET",
    discordToken: "DISCORD_TOKEN"
});

class Auth {
    static envKeys = authEnvKeys;

    static schema = new Schema({
        jwtSecret: { type: "string", default: "", allowEmpty: true },
        discordToken: { type: "string", optional: true }
    });

    static load(filePath, processEnv = process.env) {
        const jsonData = Auth._readJson(filePath),
            data = Auth._createAuthData(jsonData, processEnv),
            validated = Auth.schema.validate(data);

        return new Auth(validated);
    }

    constructor(data = {}) {
        Object.assign(this, data);
        Object.freeze(this);
    }

    static _readJson(filePath) {
        if (!fs.existsSync(filePath)) {
            return {};
        }

        let content;

        try {
            content = fs.readFileSync(filePath, "utf8");
        } catch (err) {
            throw new ConfigError(`Unable to read auth configuration at "${filePath}"`, { cause: err });
        }

        try {
            return JSON.parse(content);
        } catch (err) {
            throw new ConfigError(`Auth configuration at "${filePath}" is not valid JSON`, { cause: err });
        }
    }

    static _createAuthData(jsonData, envData) {
        const json = typeof jsonData === "object" && jsonData !== null && !Array.isArray(jsonData) ? jsonData : {},
            env = typeof envData === "object" && envData !== null ? envData : {};

        const jwtSecret = Util.nonemptyString(json.jwtSecret) ? json.jwtSecret : env[authEnvKeys.jwtSecret],
            discordToken = Util.nonemptyString(json.discordToken) ? json.discordToken : env[authEnvKeys.discordToken];

        return {
            jwtSecret: jwtSecret ?? "",
            discordToken: discordToken ?? null
        };
    }
}

const authPath = path.resolve(process.cwd(), "config/auth.json"),
    auth = Auth.load(authPath);

export default auth;
