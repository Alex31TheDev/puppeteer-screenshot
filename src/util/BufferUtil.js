const BufferUtil = Object.freeze({
    encodeObjectToBuffer: obj => {
        const entries = Object.entries(obj);

        const byteCount = entries.length * 2,
            buffer = Buffer.alloc(byteCount);

        entries.forEach(function ([key, value], index) {
            if (typeof value !== "number") {
                throw new TypeError(`Value at key "${key}" is not a number.`);
            }

            buffer.writeInt16BE(value, index * 2);
        });

        return buffer;
    },

    decodeObjectFromBuffer: (data, keys) => {
        const byteCount = keys.length * 2,
            buffer = Buffer.from(data.subarray(-byteCount));

        const values = Array.from({ length: keys.length }, (_, i) => buffer.readInt16BE(i * 2));

        const obj = Object.fromEntries(keys.map((key, i) => [key, values[i]]));
        return [obj, data.subarray(0, -byteCount)];
    }
});

export default BufferUtil;
