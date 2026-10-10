import test from "node:test";
import assert from "node:assert/strict";

import AccessPolicy from "../src/policies/AccessPolicy.js";
import users from "../src/config/users.js";

import RequestError from "../src/errors/RequestError.js";
import ConfigError from "../src/errors/ConfigError.js";

test("AccessPolicy defaults both whitelists to wildcards when neither is configured", () => {
    const policy = new AccessPolicy();

    assert.equal(policy.allowedServers, AccessPolicy.wildcard);
    assert.equal(policy.allowedChannels, AccessPolicy.wildcard);
    assert.equal(policy.isServerAllowed("927050775073534012"), true);
    assert.equal(policy.isChannelAllowed("1234567890"), true);
    assert.equal(policy.isAllowed("927050775073534012", "1234567890"), true);
    assert.doesNotThrow(() => policy.assertAllowed("927050775073534012", "1234567890"));
});

test("AccessPolicy defaults channels to empty when only server whitelist is configured", () => {
    const policy = new AccessPolicy({
        allowedServers: ["927050775073534012"]
    });

    assert.deepEqual(policy.allowedServers, ["927050775073534012"]);
    assert.deepEqual(policy.allowedChannels, []);

    assert.equal(policy.isServerAllowed("927050775073534012"), true);
    assert.equal(policy.isServerAllowed("111111111111111111"), false);
    assert.equal(policy.isChannelAllowed("1234567890"), false);

    assert.equal(policy.isAllowed("927050775073534012", "1234567890"), true);
    assert.equal(policy.isAllowed("111111111111111111", "1234567890"), false);

    assert.doesNotThrow(() => policy.assertAllowed("927050775073534012", "1234567890"));
    assert.throws(
        () => policy.assertAllowed("111111111111111111", "1234567890"),
        err => err instanceof RequestError && err.status === 403
    );
});

test("AccessPolicy defaults servers to empty when only channel whitelist is configured", () => {
    const policy = new AccessPolicy({
        allowedChannels: ["1234567890"]
    });

    assert.deepEqual(policy.allowedServers, []);
    assert.deepEqual(policy.allowedChannels, ["1234567890"]);

    assert.equal(policy.isServerAllowed("927050775073534012"), false);
    assert.equal(policy.isChannelAllowed("1234567890"), true);
    assert.equal(policy.isChannelAllowed("9999999999"), false);

    assert.equal(policy.isAllowed("927050775073534012", "1234567890"), true);
    assert.equal(policy.isAllowed("927050775073534012", "9999999999"), false);

    assert.doesNotThrow(() => policy.assertAllowed("927050775073534012", "1234567890"));
    assert.throws(
        () => policy.assertAllowed("927050775073534012", "9999999999"),
        err => err instanceof RequestError && err.status === 403
    );
});

test("AccessPolicy allows either server or channel when both are configured", () => {
    const policy = new AccessPolicy({
        allowedServers: ["111"],
        allowedChannels: ["222"]
    });

    assert.deepEqual(policy.allowedServers, ["111"]);
    assert.deepEqual(policy.allowedChannels, ["222"]);

    assert.equal(policy.isAllowed("111", "999"), true);
    assert.equal(policy.isAllowed("999", "222"), true);
    assert.equal(policy.isAllowed("999", "999"), false);
});

test("AccessPolicy handles explicit wildcard strings and wildcard in array", () => {
    const stringWildcard = new AccessPolicy({
        allowedServers: "*",
        allowedChannels: ["*"]
    });

    assert.equal(stringWildcard.allowedServers, AccessPolicy.wildcard);
    assert.equal(stringWildcard.allowedChannels, AccessPolicy.wildcard);
    assert.equal(stringWildcard.isAllowed("any-server", "any-channel"), true);
});

test("AccessPolicy rejects invalid serverId and channelId types gracefully", () => {
    const policy = new AccessPolicy({
        allowedServers: ["111"]
    });

    assert.equal(policy.isServerAllowed(""), false);
    assert.equal(policy.isServerAllowed(null), false);
    assert.equal(policy.isServerAllowed(undefined), false);
    assert.equal(policy.isChannelAllowed(""), false);
    assert.equal(policy.isChannelAllowed(null), false);
    assert.equal(policy.isChannelAllowed(undefined), false);
});

test("AccessPolicy throws ConfigError on invalid whitelist options", () => {
    assert.throws(() => new AccessPolicy({ allowedServers: 123 }), ConfigError);
    assert.throws(() => new AccessPolicy({ allowedServers: [123] }), ConfigError);
    assert.throws(() => new AccessPolicy({ allowedServers: [""] }), ConfigError);
    assert.throws(() => new AccessPolicy({ allowedServers: ["   "] }), ConfigError);
    assert.throws(() => new AccessPolicy({ allowedChannels: {} }), ConfigError);
});

test("UserStore loads test user with configured server whitelist", async () => {
    const user = await users.find("test");

    assert.ok(user !== null);
    assert.equal(user.username, "test");
    assert.deepEqual(user.allowedServers, ["927050775073534012"]);
    assert.deepEqual(user.allowedChannels, []);
    assert.ok(user.accessPolicy instanceof AccessPolicy);

    assert.equal(user.accessPolicy.isAllowed("927050775073534012", "random-channel"), true);
    assert.equal(user.accessPolicy.isAllowed("other-server", "random-channel"), false);
});
