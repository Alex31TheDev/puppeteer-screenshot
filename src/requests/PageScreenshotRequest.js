import RequestError from "../errors/RequestError.js";

class PageScreenshotRequest {
    static from(body) {
        if (body === null || Array.isArray(body) || typeof body !== "object") {
            throw new RequestError("A JSON request body is required");
        }

        const { url, clip, scrollTo } = body;

        if (typeof url !== "string" || url.trim().length === 0 || url.length > 8192) {
            throw new RequestError("A non-empty URL is required");
        }

        PageScreenshotRequest._clip(clip);

        if (
            typeof scrollTo !== "undefined" &&
            (typeof scrollTo !== "string" || scrollTo.trim().length === 0 || scrollTo.length > 4096)
        ) {
            throw new RequestError("The scrollTo selector must be a non-empty string");
        }

        return new PageScreenshotRequest(url.trim(), clip, scrollTo?.trim());
    }

    constructor(url, clip, scrollTo) {
        this.url = url;
        this.clip = clip;
        this.scrollTo = scrollTo;
    }

    static _clip(clip) {
        if (typeof clip === "undefined" || clip === "element") return;

        if (clip === null || Array.isArray(clip) || typeof clip !== "object") {
            throw new RequestError('The clip must be an object or "element"');
        }

        const values = [clip.x, clip.y, clip.width, clip.height];

        if (!values.every(Number.isFinite) || clip.width <= 0 || clip.height <= 0 || clip.x < 0 || clip.y < 0) {
            throw new RequestError(
                "The clip must contain finite x, y, width, and height values with positive dimensions"
            );
        }
    }
}

export default PageScreenshotRequest;
