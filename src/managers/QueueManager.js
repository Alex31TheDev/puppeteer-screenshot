import logger from "../logger/logger.js";

import Util from "../util/Util.js";

class QueueManager {
    constructor(options = {}) {
        const { maxConcurrentRequests = 10, maxRetries = 3, retryDelay = 2000 } = options;

        this.maxConcurrentRequests = maxConcurrentRequests;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;

        this._queues = new Map();
    }

    getQueue(name) {
        let queue = this._queues.get(name);

        if (typeof queue === "undefined") {
            queue = {
                items: [],
                running: false
            };
            this._queues.set(name, queue);
        }

        return queue;
    }

    size(name) {
        const queue = this._queues.get(name);
        if (typeof queue === "undefined") return 0;

        return queue.items.length + (queue.running ? 1 : 0);
    }

    isFull(name) {
        return this.size(name) >= this.maxConcurrentRequests;
    }

    enqueue(name, task, options = {}) {
        const queue = this.getQueue(name),
            isRetryable = options.isRetryable ?? (() => false);

        return new Promise((resolve, reject) => {
            const item = {
                task,
                resolve,
                reject,
                retries: 0,
                isRetryable
            };

            queue.items.push(item);
            this._process(name);
        });
    }

    async _process(name) {
        const queue = this.getQueue(name);
        if (queue.running || queue.items.length === 0) return;

        queue.running = true;
        const item = queue.items.shift();

        try {
            const result = await item.task();
            item.resolve(result);
        } catch (err) {
            if (item.isRetryable(err) && item.retries < this.maxRetries) {
                item.retries++;
                logger.warn(
                    `Task in queue "${name}" failed with crash error. Retrying (${item.retries}/${this.maxRetries})...`,
                    err
                );

                if (this.retryDelay > 0) {
                    await Util.delay(this.retryDelay);
                }

                queue.items.unshift(item);
            } else {
                item.reject(err);
            }
        } finally {
            queue.running = false;
            this._process(name);
        }
    }
}

export default QueueManager;
