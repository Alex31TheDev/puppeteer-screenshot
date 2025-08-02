import logger from "../logger/logger.js";
import config from "../config/config.js";

import { fetchUser } from "../auth/users.js";
import { jwtVerifyAsync, isTokenValid } from "../auth/auth.js";

async function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"],
        authSplit = authHeader?.split(" ");

    if (authSplit && authSplit[0] !== "Token") {
        const error = "Invalid token";
        logger.error(`Auth error: ${error}`);
        return res.status(401).json({ error });
    }

    const token = authSplit?.[1];

    if (typeof token !== "string" || token.length < 1) {
        const error = "No token provided";
        logger.error(`Auth error: ${error}`);
        return res.status(401).json({ error });
    }

    let decoded;

    try {
        decoded = await jwtVerifyAsync(token, config.jwtSecret);
    } catch (err) {
        logger.error("Verifying auth token failed:", err);
        return res.status(403).json({ error: "Invalid token" });
    }

    const user = fetchUser(decoded.username);

    if (!user || !isTokenValid(decoded, user)) {
        const error = "Invalid credentials";
        logger.error(`Auth error: ${error}`);
        return res.status(401).json({ error });
    }

    req.user = user;
    logger.info(`Authenticated as: ${user.username}`);

    next();
}

export default authenticateToken;
