import PuppeteerService from "./PuppeteerService.js";

import logger from "../logger/logger.js";

let services = {};

async function initServices() {
    services.puppeteer = new PuppeteerService();
}

async function setupServices() {
    logger.info("Setting up services...");

    initServices();

    process.on("SIGINT", async () => {
        await shutdownServices();
        process.exit(0);
    });

    process.on("SIGTERM", async () => {
        await shutdownServices();
        process.exit(0);
    });

    for (const [name, service] of Object.entries(services)) {
        try {
            await service.init();
        } catch (err) {
            logger.error(`Error occured while setting up "${name}" service:`, err);

            await service.close();
            return false;
        }
    }

    return true;
}

async function shutdownServices() {
    logger.info("Shutting down services...");

    for (const [name, service] of Object.entries(services)) {
        try {
            await service.close();
        } catch (err) {
            logger.error(`Error occured while shutting down "${name}" service:`, err);
        }
    }

    services = {};
}

export { setupServices, shutdownServices, services };
