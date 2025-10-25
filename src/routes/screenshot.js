import fsPromises from "fs/promises";

import { services } from "../services/services.js";

import logger from "../logger/logger.js";

import Util from "../util/Util.js";

async function screenshot(req, res) {
    const { url, clip, scrollTo } = req.body;

    if (typeof url !== "string") {
        const error = "URL is required";
        logger.error(`Request error: ${error}`);
        return res.status(400).json({ error });
    }

    if (!["undefined", "string", "object"].includes(typeof clip)) {
        const error = "Invalid clip provided";
        logger.error(`Request error: ${error}:`);
        return res.status(400).json({ error });
    } else if (typeof clip === "object") {
        if (![clip.x, clip.y, clip.width, clip.height].every(pos => typeof pos === "number")) {
            const error = "Invalid clip provided. It must have x, y, width, and height";
            logger.error(`Request error: ${error}`);
            return res.status(400).json({ error });
        }
    }

    if (!["undefined", "string"].includes(typeof scrollTo)) {
        const error = "Invalid selector provided";
        logger.error(`Request error: ${error}`);
        return res.status(400).json({ error });
    }

    let filePath = null;

    try {
        filePath = await services.puppeteer.captureScreenshot(url, { clip, scrollTo });
    } catch (err) {
        const error = "Failed to capture screenshot";
        logger.error(`Request error: ${error}:`, err);
        return res.status(500).json({ error, details: err.message });
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
            const error = "Invalid or empty message IDs provided";
            logger.error(`Request error: ${error}`);
            return res.status(400).json({ error });
        }
    } else {
        if (!Util.nonemptyString(messageId)) {
            const error = "Invalid or empty message ID provided";
            logger.error(`Request error: ${error}`);
            return res.status(400).json({ error });
        }
    }

    if (![serverId, channelId].every(Util.nonemptyString)) {
        const error = "Valid server and channel IDs are required";
        logger.error(`Request error: ${error}`);
        return res.status(400).json({ error });
    }

    let filePath = null;

    try {
        filePath = await services.puppeteer.captureMessageScreenshot(serverId, channelId, messageId, {
            trim,
            sed
        });
    } catch (err) {
        const error = "Failed to capture message screenshot";
        logger.error(`Request error: ${error}:`, err);
        return res.status(500).json({ error, details: err.message });
    }

    res.download(filePath, err => {
        if (err) logger.error("Error occured while sending response file:", err);
        fsPromises.unlink(filePath);
    });
}

export { screenshot, messageScreenshot };
