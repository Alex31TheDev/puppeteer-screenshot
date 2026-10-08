import test from "node:test";
import assert from "node:assert/strict";

import NavigationPolicy from "../src/services/NavigationPolicy.js";

test("NavigationPolicy rejects non-web and private-network targets", async () => {
    const policy = new NavigationPolicy();

    await assert.rejects(policy.assertAllowed("file:///secret.txt"));
    await assert.rejects(policy.assertAllowed("http://127.0.0.1"));
    await assert.rejects(policy.assertAllowed("http://localhost"));
    await assert.rejects(policy.assertAllowed("http://10.0.0.1"));
    await assert.rejects(policy.assertAllowed("http://192.168.1.1"));
    await assert.rejects(policy.assertAllowed("http://[::1]"));
});

test("NavigationPolicy allows private targets when allowLocalhostRequests is true", async () => {
    const policy = new NavigationPolicy({ allowLocalhostRequests: true });

    assert.equal((await policy.assertAllowed("http://localhost:3000")).hostname, "localhost");
    assert.equal((await policy.assertAllowed("http://127.0.0.1:3000")).hostname, "127.0.0.1");
});
