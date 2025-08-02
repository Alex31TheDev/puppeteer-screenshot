import { fetchUser } from "../auth/users.js";
import { isPasswordValid, jwtCreateToken } from "../auth/auth.js";

import logger from "../logger/logger.js";

async function login(req, res) {
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
        const error = "Username and password are required";
        logger.error(`Login error: ${error}`);
        return res.status(400).json({ error });
    }

    const user = fetchUser(username);

    if (!user) {
        const error = "Invalid credentials";
        logger.error(`Login error: ${error}`);
        return res.status(401).json({ error });
    }

    if (!(await isPasswordValid(user, password))) {
        const error = "Invalid credentials";
        logger.error(`Login error: ${error}`);
        return res.status(401).json({ error });
    }

    const token = jwtCreateToken(user);
    logger.info(`User "${username}" logged in successfully.`);

    res.status(200).json({ token });
}

export default login;
