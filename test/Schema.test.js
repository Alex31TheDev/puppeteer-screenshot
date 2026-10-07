import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import Schema from "../src/config/Schema.js";

import ConfigError from "../src/errors/ConfigError.js";

test("Schema applies defaults and validates primitive fields", () => {
    const schema = new Schema({
        port: { type: "integer", min: 1, max: 65535, default: 3000 },
        logLevel: { type: "string", default: "info" },
        enabled: { type: "boolean", default: true },
        ratio: { type: "number", min: 0, max: 10, default: 1.5 }
    });

    const result = schema.validate({});

    assert.equal(result.port, 3000);
    assert.equal(result.logLevel, "info");
    assert.equal(result.enabled, true);
    assert.equal(result.ratio, 1.5);
    assert.ok(Object.isFrozen(result));
});

test("Schema resolves paths and handles optional fields", () => {
    const schema = new Schema({
        logDir: { type: "path", default: "./logs" },
        userAgent: { type: "string", optional: true }
    });

    const withDefaults = schema.validate({});

    assert.equal(withDefaults.logDir, path.resolve(process.cwd(), "./logs"));
    assert.equal(withDefaults.userAgent, null);

    const withValues = schema.validate({
        logDir: "custom/path",
        userAgent: "MyAgent/1.0"
    });

    assert.equal(withValues.logDir, path.resolve(process.cwd(), "custom/path"));
    assert.equal(withValues.userAgent, "MyAgent/1.0");
});

test("Schema handles nested object schemas and applies sub-defaults", () => {
    const schema = new Schema({
        window: {
            type: "object",
            schema: {
                width: { type: "integer", min: 1, default: 1920 },
                height: { type: "integer", min: 1, default: 1080 },
                fullscreen: { type: "boolean", default: false }
            }
        }
    });

    const defaulted = schema.validate({});

    assert.deepEqual(defaulted.window, { width: 1920, height: 1080, fullscreen: false });
    assert.ok(Object.isFrozen(defaulted.window));

    const partiallyCustom = schema.validate({ window: { width: 1280 } });

    assert.deepEqual(partiallyCustom.window, { width: 1280, height: 1080, fullscreen: false });
});

test("Schema validates arrays and deduplicates when unique is true", () => {
    const schema = new Schema({
        args: {
            type: "array",
            itemType: "string",
            unique: true,
            default: ["--disable-gpu"]
        }
    });

    const defaulted = schema.validate({});

    assert.deepEqual(defaulted.args, ["--disable-gpu"]);
    assert.ok(Object.isFrozen(defaulted.args));

    const customized = schema.validate({ args: ["--no-sandbox", "--disable-gpu", " --no-sandbox "] });

    assert.deepEqual(customized.args, ["--no-sandbox", "--disable-gpu"]);
});

test("Schema throws ConfigError on invalid input types", () => {
    const schema = new Schema({
        port: { type: "integer", min: 1, max: 65535, default: 3000 },
        host: { type: "string", default: "localhost" }
    });

    assert.throws(() => schema.validate("not an object"), ConfigError);
    assert.throws(() => schema.validate({ port: "invalid" }), ConfigError);
    assert.throws(() => schema.validate({ port: 99999 }), ConfigError);
    assert.throws(() => schema.validate({ host: "" }), ConfigError);
});
