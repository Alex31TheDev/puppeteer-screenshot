import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import config from "../config/config.js";

async function isPasswordValid(user, password) {
    return await bcrypt.compare(password, user.password);
}

function isTokenValid(user, decoded) {
    return decoded.lastUpdated === user.lastUpdatedHash;
}

function jwtCreateToken(user) {
    return jwt.sign(
        {
            username: user.username,
            lastUpdated: user.lastUpdatedHash
        },
        config.jwtSecret,
        {
            expiresIn: user.validFor
        }
    );
}

function jwtVerifyAsync(token, secret) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded);
        });
    });
}

export { jwtCreateToken, jwtVerifyAsync, isPasswordValid, isTokenValid };
