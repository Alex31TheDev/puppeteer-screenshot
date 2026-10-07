import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import auth from "../src/config/auth.js";

import ConfigError from "../src/errors/ConfigError.js";

const Auth = auth.constructor,
    authEnvKeys = Auth.envKeys;

test("auth exports default auth instance", () => {
    assert.equal(typeof auth, "object");
    assert.equal(typeof auth.jwtSecret, "string");
    assert.ok(auth.discordToken === null || typeof auth.discordToken === "string");
    assert.ok(Object.isFrozen(auth));
});

test("Auth.load reads from auth.json when present", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ps-auth-test-")),
        authFile = path.join(tempDir, "auth.json");

    try {
        await fs.writeFile(
            authFile,
            JSON.stringify({
                jwtSecret: "secret-from-json-file-1234567890",
                discordToken: "token-from-json"
            })
        );

        const loaded = Auth.load(authFile, {});

        assert.equal(loaded.jwtSecret, "secret-from-json-file-1234567890");
        assert.equal(loaded.discordToken, "token-from-json");
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

test("Auth.load falls back to environment variables when auth.json is missing", () => {
    const loaded = Auth.load("non-existent-auth.json", {
        [authEnvKeys.jwtSecret]: "env-secret-12345678901234567890",
        [authEnvKeys.discordToken]: "env-discord-token"
    });

    assert.equal(loaded.jwtSecret, "env-secret-12345678901234567890");
    assert.equal(loaded.discordToken, "env-discord-token");
});

test("Auth.load prefers json values over environment variables", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ps-auth-test-")),
        authFile = path.join(tempDir, "auth.json");

    try {
        await fs.writeFile(
            authFile,
            JSON.stringify({
                jwtSecret: "json-secret-12345678901234567890"
            })
        );

        const loaded = Auth.load(authFile, {
            [authEnvKeys.jwtSecret]: "env-secret",
            [authEnvKeys.discordToken]: "env-token"
        });

        assert.equal(loaded.jwtSecret, "json-secret-12345678901234567890");
        assert.equal(loaded.discordToken, "env-token");
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

test("Auth.load throws ConfigError on invalid JSON", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ps-auth-test-")),
        authFile = path.join(tempDir, "auth.json");

    try {
        await fs.writeFile(authFile, "{ invalid json");

        assert.throws(() => Auth.load(authFile, {}), ConfigError);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});
