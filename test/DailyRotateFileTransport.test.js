import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import winston from "winston";

import DailyRotateFileTransport from "../src/logger/DailyRotateFileTransport.js";
import logger from "../src/logger/logger.js";

import LoggerError from "../src/errors/LoggerError.js";

test("DailyRotateFileTransport throws LoggerError when logFile is not provided or empty", () => {
    assert.throws(() => new DailyRotateFileTransport(), LoggerError);
    assert.throws(() => new DailyRotateFileTransport({}), LoggerError);
    assert.throws(() => new DailyRotateFileTransport({ logFile: "" }), LoggerError);
    assert.throws(() => new DailyRotateFileTransport({ logFile: 123 }), LoggerError);
});

test("DailyRotateFileTransport sets initial filename with current date and level", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "log-test-"));
    const logFile = path.join(tmpDir, "app.log");

    try {
        const transport = new DailyRotateFileTransport({
            logFile,
            level: "info"
        });

        const today = new Date().toISOString().slice(0, 10);
        assert.equal(transport.currentDate, today);
        assert.equal(transport.filename, `${today}-app-info.log`);
        assert.equal(transport.dirname, tmpDir);

        transport.close();
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test("DailyRotateFileTransport rotates files when the date changes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "log-rotate-test-"));
    const logFile = path.join(tmpDir, "server.log");

    try {
        const transport = new DailyRotateFileTransport({
            logFile,
            level: "info",
            format: winston.format.json()
        });

        const today = new Date().toISOString().slice(0, 10);
        assert.equal(transport.currentDate, today);

        transport.currentDate = "2020-01-01";
        transport.filename = `2020-01-01-server-info.log`;
        transport._basename = transport.filename;

        let rotationTriggered = false;
        const originalRunRotation = transport._runRotation.bind(transport);
        transport._runRotation = () => {
            rotationTriggered = true;
            originalRunRotation();
        };

        const testLogger = winston.createLogger({
            transports: [transport]
        });

        testLogger.info("testing rollover");

        assert.equal(rotationTriggered, true);
        assert.equal(transport.currentDate, today);
        assert.equal(transport.filename, `${today}-server-info.log`);

        transport.close();
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test("logger default instance is configured and has stream handler", () => {
    assert.ok(logger);
    assert.equal(typeof logger.stream.write, "function");
});
