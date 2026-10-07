import test from "node:test";
import assert from "node:assert/strict";

import NavigationPolicy from "../src/services/NavigationPolicy.js";

test("NavigationPolicy rejects non-web and private-network targets", async () => {
    const policy = new NavigationPolicy();

    await assert.rejects(policy.assertAllowed("file:///secret.txt"));
    await assert.rejects(policy.assertAllowed("http://127.0.0.1"));
    await assert.rejects(policy.assertAllowed("http://localhost"));
});
