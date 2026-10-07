import logger from "../logger/logger.js";

function errorWrapper(err, _, res, next) {
    if (res.headersSent) {
        next(err);
        return;
    }

    const status = Number.isInteger(err?.status) ? err.status : 500,
        message = err?.expose ? err.message : "Internal server error";

    if (status >= 500) logger.error("Unhandled request error", err);

    res.status(status).json({ error: message });
}

export default errorWrapper;
