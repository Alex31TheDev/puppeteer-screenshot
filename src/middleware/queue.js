import PuppeteerService from "../services/PuppeteerService.js";
import QueueManager from "../managers/QueueManager.js";

import config from "../config/config.js";

const queueManager = new QueueManager({
    maxConcurrentRequests: config.maxConcurrentRequests,
    maxRetries: config.maxCrashRetries,
    retryDelay: config.discordCrashCheckInterval
});

function createQueue(queueName, handler, options = {}) {
    const isRetryable = options.isRetryable ?? PuppeteerService.isCrashError;

    return async (req, res, next) => {
        if (queueManager.isFull(queueName)) {
            res.status(503).json({ error: "The requested screenshot resource is busy. Please try again later." });
            return;
        }

        try {
            await queueManager.enqueue(
                queueName,
                () => {
                    if (res.writableEnded || res.destroyed) return;
                    return handler(req, res);
                },
                { isRetryable }
            );
        } catch (err) {
            next(err);
        }
    };
}

export default createQueue;
export { queueManager };
