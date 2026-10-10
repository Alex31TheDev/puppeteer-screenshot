import Util from "../util/Util.js";

import RequestError from "../errors/RequestError.js";
import ConfigError from "../errors/ConfigError.js";

class AccessPolicy {
    static wildcard = "*";

    constructor(options = {}) {
        const { allowedServers, allowedChannels } = options ?? {};

        const hasServers = typeof allowedServers !== "undefined",
            hasChannels = typeof allowedChannels !== "undefined";

        const defaultFallback = !hasServers && !hasChannels ? AccessPolicy.wildcard : [];

        const rawServers = allowedServers ?? defaultFallback,
            rawChannels = allowedChannels ?? defaultFallback;

        this._allowedServers = AccessPolicy._parseWhitelist(rawServers, "allowedServers");
        this._allowedChannels = AccessPolicy._parseWhitelist(rawChannels, "allowedChannels");
    }

    get allowedServers() {
        return this._allowedServers === AccessPolicy.wildcard ? AccessPolicy.wildcard : [...this._allowedServers];
    }

    get allowedChannels() {
        return this._allowedChannels === AccessPolicy.wildcard ? AccessPolicy.wildcard : [...this._allowedChannels];
    }

    isServerAllowed(serverId) {
        if (!Util.nonemptyString(serverId)) return false;
        if (this._allowedServers === AccessPolicy.wildcard) return true;

        return this._allowedServers.has(serverId);
    }

    isChannelAllowed(channelId) {
        if (!Util.nonemptyString(channelId)) return false;
        if (this._allowedChannels === AccessPolicy.wildcard) return true;

        return this._allowedChannels.has(channelId);
    }

    isAllowed(serverId, channelId) {
        return this.isServerAllowed(serverId) || this.isChannelAllowed(channelId);
    }

    assertAllowed(serverId, channelId) {
        if (!this.isAllowed(serverId, channelId)) {
            throw new RequestError("Access to this server or channel is not allowed", 403);
        }
    }

    static _parseWhitelist(value, name) {
        if (value === AccessPolicy.wildcard) {
            return AccessPolicy.wildcard;
        }

        if (Array.isArray(value)) {
            if (value.includes(AccessPolicy.wildcard)) {
                return AccessPolicy.wildcard;
            }

            for (const item of value) {
                if (!Util.nonemptyString(item) || item.trim().length === 0) {
                    throw new ConfigError(`Every item in ${name} must be a non-empty string`);
                }
            }

            return new Set(value);
        }

        throw new ConfigError(`${name} must be an array of strings or "*"`);
    }
}

export default AccessPolicy;
