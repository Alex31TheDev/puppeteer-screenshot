import Util from "../util/Util.js";

import RequestError from "../errors/RequestError.js";

class MessageScreenshotRequest {
    static maxMessageCount = 25;

    static from(body) {
        if (body === null || Array.isArray(body) || typeof body !== "object") {
            throw new RequestError("A JSON request body is required");
        }

        const { serverId, channelId, messageId, trim = true, sed } = body,
            rawMessageId = body.messageIds ?? messageId,
            messageIds = Array.isArray(rawMessageId) ? rawMessageId : [rawMessageId];

        if (![serverId, channelId].every(Util.nonemptyString)) {
            throw new RequestError("Valid server and channel IDs are required");
        }

        if (
            messageIds.length === 0 ||
            messageIds.length > MessageScreenshotRequest.maxMessageCount ||
            !messageIds.every(Util.nonemptyString)
        ) {
            throw new RequestError("One or more valid message IDs are required");
        }

        if (typeof trim !== "boolean") {
            throw new RequestError("The trim option must be a boolean");
        }

        MessageScreenshotRequest._sed(sed);

        return new MessageScreenshotRequest(serverId, channelId, messageIds, trim, sed ?? undefined);
    }

    constructor(serverId, channelId, messageIds, trim, sed) {
        this.serverId = serverId;
        this.channelId = channelId;
        this.messageIds = messageIds;
        this.trim = trim;
        this.sed = sed;
    }

    static _sed(sed) {
        if (sed == null) return;

        if (Array.isArray(sed) || typeof sed !== "object") {
            throw new RequestError("The sed option must be an object");
        }

        const { regex, flags = "i", replace } = sed;

        if (
            ![regex, flags, replace].every(value => typeof value === "string") ||
            regex.length > 1024 ||
            flags.length > 16 ||
            replace.length > 8192
        ) {
            throw new RequestError("The sed option requires string regex, flags, and replace values");
        }
    }
}

export default MessageScreenshotRequest;
