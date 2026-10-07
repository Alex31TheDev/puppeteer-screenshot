import ReferenceError from "./ReferenceError.js";

class ScreenshotError extends ReferenceError {
    constructor(message, ref, status = 500, ...args) {
        super(message, ref, ...args);

        this.status = status;
        this.expose = status < 500;
    }
}

export default ScreenshotError;
