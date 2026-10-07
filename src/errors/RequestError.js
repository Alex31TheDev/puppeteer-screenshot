import CustomError from "./CustomError.js";

class RequestError extends CustomError {
    constructor(message, status = 400, ...args) {
        super(message, ...args);

        this.status = status;
        this.expose = true;
    }
}

export default RequestError;
