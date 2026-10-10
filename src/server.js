import express from "express";
import morgan from "morgan";

import { setupServices, services } from "./services/services.js";

import auth from "./config/auth.js";
import config from "./config/config.js";
import users from "./config/users.js";

import logger from "./logger/logger.js";

import middleware from "./middleware/middleware.js";

import routes from "./routes/routes.js";

import ConfigError from "./errors/ConfigError.js";

const morganFormat = ":remote-addr :method :url :status :res[content-length] - :response-time ms";

let app;

function setupExpress() {
    app = express();

    app.disable("x-powered-by");
    app.use(express.json({ limit: config.bodyLimit, strict: true }));

    app.use(
        morgan(morganFormat, {
            stream: logger.stream
        })
    );
}

function setupRoutes() {
    app.post(
        "/login",
        middleware.createRateLimit(config.loginWindowMs, config.loginMaxAttempts),
        middleware.asyncHandler(routes.login)
    );

    app.use(middleware.asyncHandler(middleware.auth));
    app.post("/screenshot", middleware.createQueue("page-screenshot", routes.screenshot));

    if (services.puppeteer.useDiscord) {
        app.post("/messageScreenshot", middleware.createQueue("message-screenshot", routes.messageScreenshot));
    }

    app.use((_, res) => res.status(404).json({ error: "Route not found" }));
    app.use(middleware.errorWrapper);
}

function startListening() {
    const port = config.port;

    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            logger.info(`Server running at: http://localhost:${port}`);
            resolve(server);
        });

        server.once("error", reject);
    });
}

async function startServer() {
    if (auth.jwtSecret.length < 32) {
        throw new ConfigError('jwtSecret must contain at least 32 characters. Set "jwtSecret" in config/auth.json');
    }

    await users.validate();

    if (!(await setupServices())) {
        process.exit(1);
    }

    logger.info("Setting up server...");

    setupExpress();
    setupRoutes();

    return await startListening();
}

export { startServer };
