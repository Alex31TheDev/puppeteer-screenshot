import test from "node:test";
import assert from "node:assert/strict";

import config from "../src/config/config.js";
import DefaultBrowserConfig from "../src/config/DefaultBrowserConfig.js";

import ConfigError from "../src/errors/ConfigError.js";

const Config = config.constructor;

test("Config loads active config.json correctly", () => {
    assert.equal(typeof config.port, "number");
    assert.ok(config.port > 0);
    assert.equal(typeof config.headless, "boolean");
    assert.equal(config.retryTimeout, 5000);
    assert.equal(config.retryDelay, 500);
    assert.equal(typeof config.logDir, "string");
    assert.equal(typeof config.window, "object");
    assert.equal(config.window.width, 2240);
    assert.equal(config.window.height, 4000);
    assert.ok(Array.isArray(config.args));
    assert.ok(Object.isFrozen(config));
});

test("Config.load throws ConfigError for missing or invalid files", () => {
    assert.throws(() => Config.load("non-existent-config.json"), ConfigError);
});

test("Config.schema validates and applies defaults on minimal object", () => {
    const minimal = Config.schema.validate({});

    assert.equal(minimal.port, 3000);
    assert.equal(minimal.logLevel, "info");
    assert.equal(minimal.headless, true);
    assert.equal(minimal.retryTimeout, 5000);
    assert.equal(minimal.retryDelay, 500);
    assert.equal(minimal.bodyLimit, "32kb");
    assert.equal(minimal.window.width, 1920);
    assert.equal(minimal.window.height, 1080);
    assert.deepEqual(minimal.args, DefaultBrowserConfig.args);
});
