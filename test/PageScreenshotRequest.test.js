import test from "node:test";
import assert from "node:assert/strict";

import PageScreenshotRequest from "../src/requests/PageScreenshotRequest.js";

test("PageScreenshotRequest accepts a bounded numeric clip", () => {
    const data = PageScreenshotRequest.from({
        url: "https://example.com",
        clip: { x: 0, y: 0, width: 10, height: 20 }
    });

    assert.equal(data.url, "https://example.com");
    assert.deepEqual(data.clip, { x: 0, y: 0, width: 10, height: 20 });
});

test("PageScreenshotRequest rejects invalid clip dimensions", () => {
    assert.throws(
        () => PageScreenshotRequest.from({ url: "https://example.com", clip: { x: 0, y: 0, width: 0, height: 1 } }),
        /positive dimensions/
    );
});
