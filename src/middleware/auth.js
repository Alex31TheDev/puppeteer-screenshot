import { fetchUser } from "../auth/users.js";
import { jwtVerifyAsync, isTokenValid } from "../auth/auth.js";

import auth from "../config/auth.js";

import RequestError from "../errors/RequestError.js";

async function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"],
        [scheme, token] = authHeader?.split(/\s+/, 2) ?? [];

    if (scheme !== "Bearer" || typeof token !== "string" || token.length === 0) {
        next(new RequestError("A Bearer token is required", 401));
        return;
    }

    let decoded;

    try {
        decoded = await jwtVerifyAsync(token, auth.jwtSecret);
    } catch (err) {
        next(new RequestError("Invalid token", 401));
        return;
    }

    const user = await fetchUser(decoded.sub);

    if (!user || !isTokenValid(decoded, user)) {
        next(new RequestError("Invalid credentials", 401));
        return;
    }

    req.user = user;
    next();
}

export default authenticateToken;
