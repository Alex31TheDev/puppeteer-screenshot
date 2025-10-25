import LockManager from "../managers/LockManager.js";
const lockManager = new LockManager();

function lockRequest(req, res, next) {
    const lockName = req.originalUrl;

    if (lockManager.acquireLock(lockName)) {
        res.on("finish", () => {
            lockManager.releaseLock(lockName);
        });

        next();
    } else {
        res.status(503);
        res.end(`The "${lockName}" route is currently locked. Please try again later.`);
    }
}

export default lockRequest;
