import test from "node:test";
import assert from "node:assert/strict";

import QueueManager from "../src/managers/QueueManager.js";
import ScreenshotError from "../src/errors/ScreenshotError.js";
import Util from "../src/util/Util.js";

test("QueueManager enqueues and executes tasks sequentially", async () => {
    const queue = new QueueManager({ maxConcurrentRequests: 5 }),
        order = [];

    const p1 = queue.enqueue("test", async () => {
        await Util.delay(1);
        order.push(1);
        return "result1";
    });

    const p2 = queue.enqueue("test", async () => {
        await Util.delay(1);
        order.push(2);
        return "result2";
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(r1, "result1");
    assert.equal(r2, "result2");
    assert.deepEqual(order, [1, 2]);
});

test("QueueManager rejects when queue is full", () => {
    const queue = new QueueManager({ maxConcurrentRequests: 2 });

    let resolve1;
    const blockPromise = new Promise(res => {
        resolve1 = res;
    });

    queue.enqueue("full-test", () => blockPromise);
    queue.enqueue("full-test", () => blockPromise);

    assert.equal(queue.isFull("full-test"), true);

    resolve1();
});

test("QueueManager does not retry non-retryable errors", async () => {
    const queue = new QueueManager({ maxConcurrentRequests: 5, maxRetries: 3 });
    let attempts = 0;

    await assert.rejects(
        () =>
            queue.enqueue(
                "err-test",
                async () => {
                    await Util.delay(1);
                    attempts++;
                    throw new ScreenshotError("404 not found");
                },
                { isRetryable: () => false }
            ),
        { message: "404 not found" }
    );

    assert.equal(attempts, 1);
});

test("QueueManager retries retryable crash errors up to maxRetries", async () => {
    const queue = new QueueManager({ maxConcurrentRequests: 5, maxRetries: 2, retryDelay: 10 });
    let attempts = 0;

    const result = await queue.enqueue(
        "retry-test",
        async () => {
            await Util.delay(1);
            attempts++;
            if (attempts < 2) {
                throw new ScreenshotError("Target closed");
            }
            return "recovered";
        },
        { isRetryable: err => err.message.includes("Target closed") }
    );

    assert.equal(result, "recovered");
    assert.equal(attempts, 2);
});
