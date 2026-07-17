import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(process.cwd(), "./config/config.json"),
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));

export default config;
