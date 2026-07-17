import fs from "node:fs";
import path from "node:path";

const usersPath = path.resolve(process.cwd(), "./config/users.json"),
    users = JSON.parse(fs.readFileSync(usersPath, "utf8"));

export default users;
