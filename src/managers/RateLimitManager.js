class RateLimitManager {
    constructor(windowMs, maxAttempts) {
        this.windowMs = windowMs;
        this.maxAttempts = maxAttempts;
        this._attempts = new Map();
    }

    tryAcquire(key) {
        const now = Date.now(),
            current = this._attempts.get(key),
            expires = now + this.windowMs;

        this._prune(now);

        if (typeof current === "undefined" || current.expires <= now) {
            this._attempts.set(key, { count: 1, expires });
            return true;
        }

        if (current.count >= this.maxAttempts) return false;

        current.count++;
        return true;
    }

    _prune(now) {
        if (this._attempts.size < 1000) return;

        for (const [key, attempt] of this._attempts) {
            if (attempt.expires <= now) this._attempts.delete(key);
        }
    }
}

export default RateLimitManager;
