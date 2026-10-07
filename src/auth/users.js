import users from "../config/users.js";

import HashUtil from "../util/HashUtil.js";

async function fetchUser(username) {
    const user = await users.find(username);

    if (user === null) return null;

    return {
        ...user,
        lastUpdatedHash: HashUtil.hashData(user.lastUpdated)
    };
}

export { fetchUser };
