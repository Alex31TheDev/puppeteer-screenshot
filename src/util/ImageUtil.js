import fs from "node:fs/promises";
import path from "node:path";

import { PNG } from "pngjs";

import logger from "../logger/logger.js";

import ImageError from "../errors/ImageError.js";

class ImageUtil {
    static createImage(width, height, initAlpha = false) {
        ImageUtil._validateSize(width, height);
        const data = new Uint8Array(4 * width * height);

        if (initAlpha) {
            for (let i = 3; i < data.length; i += 4) data[i] = 255;
        }

        return { width, height, data };
    }

    static decodeImgData(imgData) {
        let png;

        try {
            png = PNG.sync.read(Buffer.from(imgData));
        } catch (err) {
            throw new ImageError("Unable to decode PNG image", { cause: err });
        }

        return {
            width: png.width,
            height: png.height,
            data: new Uint8Array(png.data)
        };
    }

    static encodeImgData(image) {
        ImageUtil._validateImage(image);

        try {
            const png = new PNG({
                width: image.width,
                height: image.height
            });

            png.data = Buffer.from(image.data);
            return PNG.sync.write(png);
        } catch (err) {
            throw new ImageError("Unable to encode PNG image", { cause: err });
        }
    }

    static readImgPixel(image, x, y) {
        if (x < 0 || x >= image.width || y < 0 || y >= image.height) return null;
        const pos = 4 * (y * image.width + x);

        return Array.from(image.data.slice(pos, pos + 4));
    }

    static setImgPixel(image, x, y, color) {
        if (x < 0 || x >= image.width || y < 0 || y >= image.height) return;
        const pos = 4 * (y * image.width + x);

        image.data[pos] = color[0] ?? 0;
        image.data[pos + 1] = color[1] ?? 0;
        image.data[pos + 2] = color[2] ?? 0;
        image.data[pos + 3] = color[3] ?? 255;
    }

    static pixelsMatch(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 4 || b.length !== 4) return false;

        for (let i = 0; i < 4; i++) {
            if (a[i] !== b[i]) return false;
        }

        return true;
    }

    static parsePath(filePath) {
        let fileDir = null;

        if (typeof filePath === "object") {
            const pathOpts = filePath;
            ({ filePath, fileDir } = pathOpts);
        }

        if (filePath == null || filePath.length < 1) {
            throw new ImageError("No file path provided");
        }

        filePath = path.resolve(fileDir || "", filePath);
        fileDir ||= path.dirname(filePath);

        return [filePath, fileDir];
    }

    static _findEdge(sums) {
        let start = 0,
            end = sums.length - 1;

        while (start < sums.length && sums[start] === 0) start++;
        while (end > start && sums[end] === 0) end--;

        return [start, end];
    }

    static findTrim(image, options = {}) {
        ImageUtil._validateImage(image);
        const threshold = options.threshold ?? 10,
            [bg_r, bg_g, bg_b] = options.background ?? [255, 255, 255];

        const rowSums = new Uint32Array(image.height),
            colSums = new Uint32Array(image.width);

        for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
                const [r, g, b] = ImageUtil.readImgPixel(image, x, y),
                    diff = Math.abs(r - bg_r) + Math.abs(g - bg_g) + Math.abs(b - bg_b);

                if (diff > threshold) {
                    rowSums[y]++;
                    colSums[x]++;
                }
            }
        }

        const [top, bottom] = ImageUtil._findEdge(rowSums),
            [left, right] = ImageUtil._findEdge(colSums);

        return top > bottom || left > right ? { top: 0, left: 0, bottom: 0, right: 0 } : { top, left, bottom, right };
    }

    static clip(image, trim) {
        ImageUtil._validateImage(image);
        if (trim === null || Array.isArray(trim) || typeof trim !== "object") {
            throw new ImageError("Image clip must be an object");
        }

        let { top, left, bottom, right } = trim;

        top = Math.max(0, Math.min(top, image.height - 1));
        left = Math.max(0, Math.min(left, image.width - 1));
        bottom = Math.max(top, Math.min(bottom, image.height - 1));
        right = Math.max(left, Math.min(right, image.width - 1));

        const w = right - left + 1;
        const h = bottom - top + 1;

        const clipped = ImageUtil.createImage(w, h);

        const yi = 4 * (image.width - w);

        let pos1 = 0;
        let pos2 = 4 * (top * image.width + left);

        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                clipped.data[pos1++] = image.data[pos2++];
                clipped.data[pos1++] = image.data[pos2++];
                clipped.data[pos1++] = image.data[pos2++];
                clipped.data[pos1++] = image.data[pos2++];
            }

            pos2 += yi;
        }

        return clipped;
    }

    static async saveImgPNG(filePath, image) {
        let fileDir;
        [filePath, fileDir] = ImageUtil.parsePath(filePath);

        const imgData = ImageUtil.encodeImgData(image);

        try {
            await fs.mkdir(fileDir, { recursive: true });
            await fs.writeFile(filePath, imgData);
        } catch (err) {
            logger.error("Error occured while writing the image:", err);
            throw err;
        }

        return filePath;
    }

    static _validateImage(image) {
        if (image === null || typeof image !== "object") {
            throw new ImageError("Image must be an object");
        }

        ImageUtil._validateSize(image.width, image.height);

        if (!(image.data instanceof Uint8Array) || image.data.length !== image.width * image.height * 4) {
            throw new ImageError("Image data must contain four bytes per pixel");
        }
    }

    static _validateSize(width, height) {
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
            throw new ImageError("Image dimensions must be positive integers");
        }
    }
}

export default ImageUtil;
