import PuppeteerService from "./PuppeteerService.js";

import logger from "../logger/logger.js";

let services = {},
    signalsRegistered = false;

function initServices() {
    services.puppeteer = new PuppeteerService();
}

function registerSignals() {
    if (signalsRegistered) return;

    signalsRegistered = true;

    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, async () => {
            await shutdownServices();
            process.exit(0);
        });
    }
}

async function setupServices() {
    logger.info("Setting up services...");

    initServices();

    registerSignals();

    for (const [name, service] of Object.entries(services)) {
        try {
            await service.init();
        } catch (err) {
            logger.error(`Error occurred while setting up "${name}" service`, err);

            await shutdownServices();
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
            logger.error(`Error occurred while shutting down "${name}" service`, err);
        }
    }

    services = {};
}

export { setupServices, shutdownServices, services };
