import LockManager from "../managers/LockManager.js";

const lockManager = new LockManager();

function createLock(lockName) {
    return (_, res, next) => {
        if (!lockManager.acquire(lockName)) {
            res.status(503).json({ error: "The requested screenshot resource is busy. Please try again later." });
            return;
        }

        const release = () => lockManager.release(lockName);
        res.once("finish", release);
        res.once("close", release);

        next();
    };
}

export default createLock;
