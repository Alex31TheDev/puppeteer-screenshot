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
    }
});

export default BufferUtil;
