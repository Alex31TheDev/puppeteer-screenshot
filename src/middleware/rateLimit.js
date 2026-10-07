import RateLimitManager from "../managers/RateLimitManager.js";
import RequestError from "../errors/RequestError.js";

function createRateLimit(windowMs, maxAttempts) {
    const manager = new RateLimitManager(windowMs, maxAttempts);

    return (req, _, next) => {
        if (manager.tryAcquire(req.ip)) {
            next();
            return;
        }

        next(new RequestError("Too many requests. Please try again later.", 429));
    };
}

export default createRateLimit;
