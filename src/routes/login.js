import { fetchUser } from "../auth/users.js";
import { isPasswordValid, jwtCreateToken } from "../auth/auth.js";

import logger from "../logger/logger.js";

function sendLoginError(res, status, error) {
    logger.error(`Login error: ${error}`);
    return res.status(status).json({ error });
}

async function login(req, res) {
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
        return sendLoginError(res, 400, "Username and password are required");
    }

    const user = fetchUser(username);

    if (!user) {
        return sendLoginError(res, 401, "Invalid credentials");
    }

    if (!(await isPasswordValid(user, password))) {
        return sendLoginError(res, 401, "Invalid credentials");
    }

    const token = jwtCreateToken(user);
    logger.info(`User "${username}" logged in successfully.`);

    res.status(200).json({ token });
}

export default login;
