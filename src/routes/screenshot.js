import fsPromises from "fs/promises";

import { services } from "../services/services.js";

import logger from "../logger/logger.js";

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
        if (![typeof clip.x, typeof clip.y, typeof clip.width, typeof clip.height].every(type => type === "number")) {
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

    let filePath;

    try {
        filePath = await services.puppeteer.captureScreenshot(url, clip, scrollTo);
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
        multipleMessages = Array.isArray(messageId);

    if (![typeof serverId, typeof channelId, typeof messageId].every(type => type === "string") && !multipleMessages) {
        const error = "Server, channel and message ids are required";
        logger.error(`Request error: ${error}`);
        return res.status(400).json({ error });
    }

    if (multipleMessages && !messageId.every(id => typeof id === "string")) {
        const error = "Invalid message ID";
        logger.error(`Request error: ${error}`);
        return res.status(400).json({ error });
    }

    let filePath;

    try {
        filePath = await services.puppeteer.captureMessageScreenshot(serverId, channelId, messageId);
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
