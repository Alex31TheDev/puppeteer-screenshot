import express from "express";
import bodyParser from "body-parser";
import morgan from "morgan";

import { setupServices, services } from "./services/services.js";

import config from "./config/config.js";
import logger from "./logger/logger.js";

import middleware from "./middleware/middleware.js";
import routes from "./routes/routes.js";

const defaultPort = 3000;
const morganFormat = ":remote-addr :method :url :status :res[content-length] - :response-time ms";

let app;

function setupExpress() {
    app = express();

    app.use(bodyParser.json());
    app.use(middleware.errorWrapper);

    app.use(
        morgan(morganFormat, {
            stream: logger.stream
        })
    );
}

function setupRoutes() {
    app.post("/login", routes.login);

    app.use(middleware.auth);
    app.post("/screenshot", routes.screenshot);

    if (services.puppeteer.useDiscord) {
        app.post("/messageScreenshot", middleware.lock, routes.messageScreenshot);
    }
}

async function startListening() {
    const port = config.port || defaultPort;

    return new Promise((resolve, reject) => {
        app.listen(port, () => {
            logger.info(`Server running at: http://localhost:${port}`);
            resolve(port);
        });
    });
}

async function startServer() {
    if (!(await setupServices())) {
        return;
    }

    logger.info("Setting up server...");

    setupExpress();
    setupRoutes();

    await startListening();
}

export { startServer };
