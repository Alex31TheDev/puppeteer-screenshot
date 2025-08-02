import fs from "fs";
import path from "path";

const usersPath = path.resolve(process.cwd(), "./config/users.json"),
    users = JSON.parse(fs.readFileSync(usersPath, "utf8"));

export default users;
