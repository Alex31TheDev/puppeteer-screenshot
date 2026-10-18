import test from "node:test";
import assert from "node:assert/strict";

import MessageScreenshotRequest from "../src/requests/MessageScreenshotRequest.js";

test("MessageScreenshotRequest accepts valid minimal payload with single messageId", () => {
    const data = MessageScreenshotRequest.from({
        serverId: "123",
        channelId: "456",
        messageId: "789"
    });

    assert.equal(data.serverId, "123");
    assert.equal(data.channelId, "456");
    assert.deepEqual(data.messageIds, ["789"]);
    assert.equal(data.trim, true);
    assert.equal(typeof data.sed, "undefined");
});

test("MessageScreenshotRequest accepts array messageIds and null sed", () => {
    const data = MessageScreenshotRequest.from({
        serverId: "123",
        channelId: "456",
        messageIds: ["789", "101112"],
        trim: false,
        sed: null
    });

    assert.deepEqual(data.messageIds, ["789", "101112"]);
    assert.equal(data.trim, false);
    assert.equal(typeof data.sed, "undefined");
});

test("MessageScreenshotRequest accepts valid sed options", () => {
    const data = MessageScreenshotRequest.from({
        serverId: "123",
        channelId: "456",
        messageId: "789",
        sed: { regex: "foo", replace: "bar", flags: "g" }
    });

    assert.deepEqual(data.sed, { regex: "foo", replace: "bar", flags: "g" });
});

test("MessageScreenshotRequest rejects invalid serverId or channelId", () => {
    assert.throws(
        () => MessageScreenshotRequest.from({ serverId: "", channelId: "456", messageId: "789" }),
        /Valid server and channel IDs are required/
    );
});

test("MessageScreenshotRequest rejects missing message IDs", () => {
    assert.throws(
        () => MessageScreenshotRequest.from({ serverId: "123", channelId: "456", messageId: [] }),
        /One or more valid message IDs are required/
    );
});

test("MessageScreenshotRequest rejects non-object sed", () => {
    assert.throws(
        () => MessageScreenshotRequest.from({ serverId: "123", channelId: "456", messageId: "789", sed: "invalid" }),
        /The sed option must be an object/
    );
});

test("MessageScreenshotRequest accepts array of valid sed options", () => {
    const rules = [
        { regex: "foo", replace: "bar", flags: "g" },
        { regex: "baz", replace: "qux", flags: "i" }
    ];

    const data = MessageScreenshotRequest.from({
        serverId: "123",
        channelId: "456",
        messageId: "789",
        sed: rules
    });

    assert.deepEqual(data.sed, rules);
});

test("MessageScreenshotRequest rejects empty array of sed options", () => {
    assert.throws(
        () => MessageScreenshotRequest.from({ serverId: "123", channelId: "456", messageId: "789", sed: [] }),
        /The sed option must be an object/
    );
});

test("MessageScreenshotRequest rejects array with invalid sed rule types", () => {
    assert.throws(
        () =>
            MessageScreenshotRequest.from({
                serverId: "123",
                channelId: "456",
                messageId: "789",
                sed: [{ regex: 123, replace: "bar" }]
            }),
        /The sed option requires string regex, flags, and replace values/
    );
});
