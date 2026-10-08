import dns from "node:dns/promises";
import net from "node:net";

import ScreenshotError from "../errors/ScreenshotError.js";

function createBlocklist() {
    const blocklist = new net.BlockList();

    // IPv4 Localhost / Loopback
    blocklist.addSubnet("127.0.0.0", 8, "ipv4");

    // IPv4 Private Network Areas (RFC 1918)
    blocklist.addSubnet("10.0.0.0", 8, "ipv4");
    blocklist.addSubnet("172.16.0.0", 12, "ipv4");
    blocklist.addSubnet("192.168.0.0", 16, "ipv4");

    // IPv4 Link-Local
    blocklist.addSubnet("169.254.0.0", 16, "ipv4");

    // IPv4 Local Endpoint
    blocklist.addAddress("0.0.0.0", "ipv4");

    // IPv6 Localhost / Loopback
    blocklist.addAddress("::1", "ipv6");

    // IPv6 Unique Local Addresses (ULA)
    blocklist.addSubnet("fc00::", 7, "ipv6");

    // IPv6 Link-Local
    blocklist.addSubnet("fe80::", 10, "ipv6");

    // IPv6 Local Endpoint
    blocklist.addAddress("::", "ipv6");

    // IPv4-compatible mapped local/private IPv6 ranges (::/96)
    blocklist.addSubnet("::7f00:0", 104, "ipv6");
    blocklist.addSubnet("::0a00:0", 104, "ipv6");
    blocklist.addSubnet("::ac10:0", 108, "ipv6");
    blocklist.addSubnet("::c0a8:0", 112, "ipv6");
    blocklist.addSubnet("::a9fe:0", 112, "ipv6");
    blocklist.addSubnet("::0000:0", 104, "ipv6");

    return blocklist;
}

function checkIP(ip, blocklist) {
    if (typeof ip !== "string") {
        return false;
    }

    const version = net.isIP(ip);

    if (version === 0) {
        return false;
    }

    return blocklist.check(ip, `ipv${version}`);
}

function parseUrl(value) {
    let url;

    try {
        url = new URL(value);
    } catch (_) {
        throw new ScreenshotError("A valid HTTP or HTTPS URL is required", value, 400);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new ScreenshotError("Only HTTP and HTTPS URLs are allowed", value, 400);
    }

    return url;
}

function blocked(url) {
    throw new ScreenshotError("Access to local/private IP addresses is blocked", url.toString(), 403);
}

class NavigationPolicy {
    static blocklist = createBlocklist();

    constructor(options = {}) {
        if (typeof options === "boolean") {
            options = { allowLocalhostRequests: options };
        }

        this.allowLocalhostRequests = options.allowLocalhostRequests ?? false;
    }

    async assertAllowed(value) {
        const url = parseUrl(value);

        if (this.allowLocalhostRequests) {
            return url;
        }

        const host = url.hostname.replace(/^\[|\]$/g, "");

        if (checkIP(host, NavigationPolicy.blocklist)) {
            blocked(url);
        }

        let addresses;

        try {
            addresses = await dns.lookup(host, { all: true, verbatim: true });
        } catch (_) {
            blocked(url);
        }

        const addrList = Array.isArray(addresses) ? addresses : [{ address: addresses }];

        for (const addrInfo of addrList) {
            if (checkIP(addrInfo.address, NavigationPolicy.blocklist)) {
                blocked(url);
            }
        }

        return url;
    }

    async isAllowed(value) {
        try {
            await this.assertAllowed(value);
            return true;
        } catch (_) {
            return false;
        }
    }
}

export default NavigationPolicy;
