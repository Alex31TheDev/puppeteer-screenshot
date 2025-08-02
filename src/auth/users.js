import users from "../config/users.js";

import HashUtil from "../util/HashUtil.js";

const defaultValidPeriod = "30d";

function fetchUser(username) {
    const user = users.find(u => u.username === username);
    if (typeof user === "undefined") return false;

    user.validFor ??= defaultValidPeriod;
    user.lastUpdatedHash = HashUtil.hashData(user.lastUpdated, "md5");

    return user;
}

export { fetchUser };
