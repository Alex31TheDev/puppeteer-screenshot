import fsPromises from "node:fs/promises";

import { services } from "../services/services.js";
import logger from "../logger/logger.js";

import PageScreenshotRequest from "../requests/PageScreenshotRequest.js";
import MessageScreenshotRequest from "../requests/MessageScreenshotRequest.js";

function sendDownload(res, filePath, profilePicture) {
    if (profilePicture !== null) {
        res.set("X-Profile-Picture-Rect", JSON.stringify(profilePicture));
    }

    res.download(filePath, async err => {
        try {
            await fsPromises.unlink(filePath);
        } catch (unlinkErr) {
            if (unlinkErr.code !== "ENOENT") logger.error("Unable to remove screenshot file", unlinkErr);
        }

        if (err) logger.error("Unable to send screenshot file", err);
    });
}

async function screenshot(req, res) {
    const data = PageScreenshotRequest.from(req.body),
        result = await services.puppeteer.captureScreenshot(data.url, data);

    sendDownload(res, result.filePath, result.profilePicture);
}

async function messageScreenshot(req, res) {
    const data = MessageScreenshotRequest.from(req.body),
        result = await services.puppeteer.captureMessageScreenshot(data.serverId, data.channelId, data.messageIds, {
            trim: data.trim,
            sed: data.sed
        });

    sendDownload(res, result.filePath, result.profilePicture);
}

export { screenshot, messageScreenshot };
