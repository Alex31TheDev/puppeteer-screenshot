import fsPromises from "node:fs/promises";

import { services } from "../services/services.js";
import logger from "../logger/logger.js";
import Util from "../util/Util.js";

function sendRequestError(res, status, error, err = null) {
    if (err === null) {
        logger.error(`Request error: ${error}`);
        return res.status(status).json({ error });
    }

    logger.error(`Request error: ${error}:`, err);
    return res.status(status).json({ error, details: err.message });
}

async function screenshot(req, res) {
    const { url, clip, scrollTo } = req.body;

    if (typeof url !== "string") {
        return sendRequestError(res, 400, "URL is required");
    }

    if (!["undefined", "string", "object"].includes(typeof clip)) {
        return sendRequestError(res, 400, "Invalid clip provided");
    } else if (typeof clip === "object") {
        if (![clip.x, clip.y, clip.width, clip.height].every(pos => typeof pos === "number")) {
            return sendRequestError(res, 400, "Invalid clip provided. It must have x, y, width, and height");
        }
    }

    if (!["undefined", "string"].includes(typeof scrollTo)) {
        return sendRequestError(res, 400, "Invalid selector provided");
    }

    let filePath = null;

    try {
        filePath = await services.puppeteer.captureScreenshot(url, { clip, scrollTo });
    } catch (err) {
        return sendRequestError(res, 500, "Failed to capture screenshot", err);
    }

    res.download(filePath, err => {
        if (err) logger.error("Error occured while sending response file:", err);
        fsPromises.unlink(filePath);
    });
}

async function messageScreenshot(req, res) {
    const { serverId, channelId, messageId } = req.body,
        { trim, sed } = req.body;

    const multipleMessages = Array.isArray(messageId);

    if (multipleMessages) {
        if (!messageId.every(Util.nonemptyString)) {
            return sendRequestError(res, 400, "Invalid or empty message IDs provided");
        }
    } else {
        if (!Util.nonemptyString(messageId)) {
            return sendRequestError(res, 400, "Invalid or empty message ID provided");
        }
    }

    if (![serverId, channelId].every(Util.nonemptyString)) {
        return sendRequestError(res, 400, "Valid server and channel IDs are required");
    }

    let filePath = null;

    try {
        filePath = await services.puppeteer.captureMessageScreenshot(serverId, channelId, messageId, {
            trim,
            sed
        });
    } catch (err) {
        return sendRequestError(res, 500, "Failed to capture message screenshot", err);
    }

    res.download(filePath, err => {
        if (err) logger.error("Error occured while sending response file:", err);
        fsPromises.unlink(filePath);
    });
}

export { screenshot, messageScreenshot };
