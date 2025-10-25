class LockManager {
    constructor() {
        this._locks = new Map();
    }

    isLocked(name) {
        return this._locks.has(name);
    }

    acquireLock(name) {
        if (this.isLocked(name)) {
            return false;
        }

        this._locks.set(name, true);
        return true;
    }

    releaseLock(name) {
        this._locks.delete(name);
    }
}

export default LockManager;
