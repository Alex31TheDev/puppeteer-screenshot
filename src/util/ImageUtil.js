import path from "path";
import fs from "fs/promises";
import { PNG } from "pngjs";

import logger from "../logger/logger.js";

const ImageUtil = Object.freeze({
    createImage: (width, height, initAlpha = false) => {
        const data = new Uint8Array(4 * width * height);

        if (initAlpha) {
            for (let i = 3; i < data.length; i += 4) data[i] = 255;
        }

        return { width, height, data };
    },

    decodeImgData: imgData => {
        let png = null;
        imgData = Buffer.from(imgData);

        try {
            png = PNG.sync.read(imgData);
        } catch (err) {
            logger.error("Error occured while decoding the image:", err);
            throw err;
        }

        return {
            width: png.width,
            height: png.height,
            data: new Uint8Array(png.data.buffer)
        };
    },

    encodeImgData: image => {
        try {
            const png = new PNG({
                width: image.width,
                height: image.height
            });

            png.data = Buffer.from(image.data);
            return PNG.sync.write(png);
        } catch (err) {
            logger.error("Error occured while encoding the image:", err);
            throw err;
        }
    },

    readImgPixel: (image, x, y) => {
        if (x < 0 || x >= image.width || y < 0 || y >= image.height) return null;
        const pos = 4 * (y * image.width + x);

        return Array.from(image.data.slice(pos, pos + 4));
    },

    setImgPixel: (image, x, y, color) => {
        if (x < 0 || x >= image.width || y < 0 || y >= image.height) return;
        const pos = 4 * (y * image.width + x);

        image.data[pos] = color[0] ?? 0;
        image.data[pos + 1] = color[1] ?? 0;
        image.data[pos + 2] = color[2] ?? 0;
        image.data[pos + 3] = color[3] ?? 255;
    },

    pixelsMatch: (a, b) => {
        for (let i = 0; i < 4; i++) {
            if (a[i] !== b[i]) return false;
        }

        return true;
    },

    parsePath: filePath => {
        let fileDir = null;

        if (typeof filePath === "object") {
            const pathOpts = filePath;
            ({ filePath, fileDir } = pathOpts);
        }

        if (filePath == null || filePath.length < 1) {
            throw new TypeError("No file path provided");
        }

        filePath = path.resolve(fileDir || "", filePath);
        fileDir ||= path.dirname(filePath);

        return [filePath, fileDir];
    },

    _findEdge: sums => {
        let start = 0,
            end = sums.length - 1;

        while (start < sums.length && sums[start] === 0) start++;
        while (end > start && sums[end] === 0) end--;

        return [start, end];
    },

    findTrim: (image, options = {}) => {
        const threshold = options.threshold ?? 10,
            [bg_r, bg_g, bg_b] = options.background ?? [255, 255, 255];

        let binaryMap = Array(image.height);
        let i, j;

        for (i = 0; i < image.height; i++) {
            binaryMap[i] = new Uint8Array(image.width);

            for (j = 0; j < image.width; j++) {
                const [r, g, b] = ImageUtil.readImgPixel(image, j, i),
                    diff = Math.abs(r - bg_r) + Math.abs(g - bg_g) + Math.abs(b - bg_b);

                binaryMap[i][j] = Number(diff > threshold);
            }
        }

        const rowSums = binaryMap.map(row => row.reduce((a, b) => a + b, 0)),
            colSums = Array.from({ length: image.width }, (_, ci) => binaryMap.reduce((sum, row) => sum + row[ci], 0));

        const [top, bottom] = ImageUtil._findEdge(rowSums),
            [left, right] = ImageUtil._findEdge(colSums);

        return top > bottom || left > right ? { top: 0, left: 0, bottom: 0, right: 0 } : { top, left, bottom, right };
    },

    clip: (image, trim) => {
        let { top, left, bottom, right } = trim;

        top = Math.max(0, Math.min(top, image.width - 1));
        left = Math.max(0, Math.min(left, image.height - 1));
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
    },

    readImgPNG: async filePath => {
        [filePath] = ImageUtil.parsePath(filePath);
        let imgData = null;

        try {
            imgData = await fs.readFile(filePath);
        } catch (err) {
            if (err.code === "ENOENT") {
                logger.error(`Image not found at path: "${filePath}".`);
            } else {
                logger.error("Error occured while reading the image:", err);
            }

            throw err;
        }

        return ImageUtil.decodeImgData(imgData);
    },

    saveImgPNG: async (filePath, image) => {
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
    },

    styleToRgb: style => {
        const match = style.match(/\d+/g);
        if (!match) return [0, 0, 0];

        return match.slice(0, 3).map(Number);
    }
});

export default ImageUtil;
