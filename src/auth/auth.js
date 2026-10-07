import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import auth from "../config/auth.js";
import config from "../config/config.js";

async function isPasswordValid(user, password) {
    return typeof password === "string" && (await bcrypt.compare(password, user.password));
}

function isTokenValid(decoded, user) {
    return decoded.lastUpdated === user.lastUpdatedHash;
}

function jwtCreateToken(user) {
    return jwt.sign(
        {
            lastUpdated: user.lastUpdatedHash
        },
        auth.jwtSecret,
        {
            algorithm: "HS256",
            audience: config.jwtAudience,
            expiresIn: config.tokenTtl,
            issuer: config.jwtIssuer,
            subject: user.username
        }
    );
}

function jwtVerifyAsync(token, secret) {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            secret,
            {
                algorithms: ["HS256"],
                audience: config.jwtAudience,
                issuer: config.jwtIssuer
            },
            (err, decoded) => {
                if (err) reject(err);
                else resolve(decoded);
            }
        );
    });
}

export { jwtCreateToken, jwtVerifyAsync, isPasswordValid, isTokenValid };
