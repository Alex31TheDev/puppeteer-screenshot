import { fetchUser } from "../auth/users.js";
import { isPasswordValid, jwtCreateToken } from "../auth/auth.js";

import RequestError from "../errors/RequestError.js";

async function login(req, res) {
    const { username, password } = req.body ?? {};

    if (
        typeof username !== "string" ||
        username.trim().length === 0 ||
        username.length > 128 ||
        typeof password !== "string" ||
        password.length === 0 ||
        password.length > 256
    ) {
        throw new RequestError("Username and password are required");
    }

    const user = await fetchUser(username.trim());

    if (!user) {
        throw new RequestError("Invalid credentials", 401);
    }

    if (!(await isPasswordValid(user, password))) {
        throw new RequestError("Invalid credentials", 401);
    }

    const token = jwtCreateToken(user);

    res.status(200).json({ token });
}

export default login;
