import fs from "fs";
import crypto from "crypto";

class HashUtil {
    static hashData(data, hashType = "sha1") {
        const hash = crypto.createHash(hashType);
        hash.setEncoding("hex");

        hash.write(data);
        hash.end();

        return hash.read();
    }

    static hashFile(path, hashType = "sha1") {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(hashType),
                stream = fs.createReadStream(path);

            hash.setEncoding("hex");

            stream.once("error", err => reject(err));
            stream.pipe(hash);

            stream.once("end", () => {
                hash.end();
                resolve(hash.read());
            });
        });
    }
}

export default HashUtil;
