import fs from "node:fs/promises";

import AccessPolicy from "../policies/AccessPolicy.js";

import config from "./config.js";

import ConfigError from "../errors/ConfigError.js";

class UserStore {
    async validate() {
        await this._read();
    }

    async find(username) {
        const users = await this._read(),
            user = users.find(user => user.username === username);

        return user ?? null;
    }

    async _read() {
        let content;

        try {
            content = await fs.readFile(config.usersPath, "utf8");
        } catch (err) {
            throw new ConfigError(`Unable to read users at "${config.usersPath}"`, { cause: err });
        }

        let users;

        try {
            users = JSON.parse(content);
        } catch (err) {
            throw new ConfigError(`Users file at "${config.usersPath}" is not valid JSON`, { cause: err });
        }

        if (!Array.isArray(users)) {
            throw new ConfigError("Users configuration must be an array");
        }

        const names = new Set();

        return users.map(user => {
            if (user === null || Array.isArray(user) || typeof user !== "object") {
                throw new ConfigError("Every user must be an object");
            }

            const { username, password, lastUpdated } = user;

            if (
                typeof username !== "string" ||
                username.trim().length === 0 ||
                typeof password !== "string" ||
                !password.startsWith("$2") ||
                typeof lastUpdated !== "string" ||
                Number.isNaN(Date.parse(lastUpdated)) ||
                names.has(username)
            ) {
                throw new ConfigError(
                    "Every user needs a unique username, bcrypt password hash, and ISO lastUpdated value"
                );
            }

            const accessPolicy = new AccessPolicy({
                allowedServers: user.allowedServers,
                allowedChannels: user.allowedChannels
            });

            names.add(username);

            return Object.freeze({
                username,
                password,
                lastUpdated,
                accessPolicy,
                allowedServers: accessPolicy.allowedServers,
                allowedChannels: accessPolicy.allowedChannels
            });
        });
    }
}

const users = new UserStore();

export default users;
