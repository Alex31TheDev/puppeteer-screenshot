import crypto from "node:crypto";

class HashUtil {
    static hashData(data, hashType = "sha256") {
        return crypto.createHash(hashType).update(data).digest("hex");
    }
}

export default HashUtil;
