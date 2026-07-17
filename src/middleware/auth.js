import { fetchUser } from "../auth/users.js";
import { jwtVerifyAsync, isTokenValid } from "../auth/auth.js";
import config from "../config/config.js";
import logger from "../logger/logger.js";

function sendAuthError(res, status, error) {
    logger.error(`Auth error: ${error}`);
    return res.status(status).json({ error });
}

async function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"],
        authSplit = authHeader?.split(" "),
        token = authSplit?.[1];

    if (authSplit && authSplit[0] !== "Token") return sendAuthError(res, 401, "Invalid token");
    if (typeof token !== "string" || token.length < 1) return sendAuthError(res, 401, "No token provided");

    let decoded = null;

    try {
        decoded = await jwtVerifyAsync(token, config.jwtSecret);
    } catch (err) {
        logger.error("Verifying auth token failed:", err);
        return res.status(403).json({ error: "Invalid token" });
    }

    const user = fetchUser(decoded.username);

    if (!user || !isTokenValid(decoded, user)) {
        return sendAuthError(res, 401, "Invalid credentials");
    }

    req.user = user;
    logger.info(`Authenticated as: ${user.username}`);

    next();
}

export default authenticateToken;
