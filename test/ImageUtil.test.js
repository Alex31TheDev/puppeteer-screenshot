import test from "node:test";
import assert from "node:assert/strict";

import ImageUtil from "../src/util/ImageUtil.js";

test("ImageUtil.clip preserves the requested rectangular pixel region", () => {
    const image = ImageUtil.createImage(3, 2, true);

    ImageUtil.setImgPixel(image, 1, 0, [255, 0, 0, 255]);
    ImageUtil.setImgPixel(image, 2, 1, [0, 255, 0, 255]);

    const clipped = ImageUtil.clip(image, { top: 0, left: 1, bottom: 1, right: 2 });

    assert.deepEqual({ width: clipped.width, height: clipped.height }, { width: 2, height: 2 });
    assert.deepEqual(ImageUtil.readImgPixel(clipped, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(ImageUtil.readImgPixel(clipped, 1, 1), [0, 255, 0, 255]);
});

test("ImageUtil.findTrim finds content bounds in one pass", () => {
    const image = ImageUtil.createImage(4, 3, true);

    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            ImageUtil.setImgPixel(image, x, y, [255, 255, 255, 255]);
        }
    }

    ImageUtil.setImgPixel(image, 2, 1, [0, 0, 0, 255]);

    assert.deepEqual(ImageUtil.findTrim(image), { top: 1, left: 2, bottom: 1, right: 2 });
});
