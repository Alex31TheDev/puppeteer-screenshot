import dns from "node:dns/promises";
import net from "node:net";

import ScreenshotError from "../errors/ScreenshotError.js";

class NavigationPolicy {
    constructor(allowPrivateNetwork = false) {
        this.allowPrivateNetwork = allowPrivateNetwork;
    }

    async assertAllowed(value) {
        const url = this._parse(value);

        if (this.allowPrivateNetwork || (await this._isPublicHost(url.hostname))) {
            return url;
        }

        throw new ScreenshotError("Blocked navigation to a private network address", url.toString(), 403);
    }

    async isAllowed(value) {
        try {
            await this.assertAllowed(value);
            return true;
        } catch (_) {
            return false;
        }
    }

    _parse(value) {
        let url;

        try {
            url = new URL(value);
        } catch (_) {
            throw new ScreenshotError("A valid HTTP or HTTPS URL is required", value, 400);
        }

        if (!["http:", "https:"].includes(url.protocol) || url.username.length > 0 || url.password.length > 0) {
            throw new ScreenshotError("Only credential-free HTTP and HTTPS URLs are allowed", value, 400);
        }

        return url;
    }

    async _isPublicHost(host) {
        const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();

        if (normalized === "localhost" || normalized.endsWith(".localhost")) return false;

        if (net.isIP(normalized)) return !NavigationPolicy._privateIp(normalized);

        let addresses;

        try {
            addresses = await dns.lookup(normalized, { all: true, verbatim: true });
        } catch (_) {
            return false;
        }

        return addresses.length > 0 && addresses.every(({ address }) => !NavigationPolicy._privateIp(address));
    }

    static _privateIp(address) {
        const family = net.isIP(address);

        if (family === 4) {
            const parts = address.split(".").map(Number),
                [a, b] = parts;

            return (
                a === 0 ||
                a === 10 ||
                a === 127 ||
                a >= 224 ||
                (a === 100 && b >= 64 && b <= 127) ||
                (a === 169 && b === 254) ||
                (a === 172 && b >= 16 && b <= 31) ||
                (a === 192 && b === 168) ||
                (a === 198 && (b === 18 || b === 19))
            );
        }

        if (family === 6) {
            const normalized = address.toLowerCase();

            return (
                normalized === "::" ||
                normalized === "::1" ||
                normalized.startsWith("fc") ||
                normalized.startsWith("fd") ||
                /^fe[89ab]/.test(normalized) ||
                normalized.startsWith("::ffff:")
            );
        }

        return true;
    }
}

export default NavigationPolicy;
