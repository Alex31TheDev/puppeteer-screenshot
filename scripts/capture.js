"use strict";

const api = "",
    token = "";

const alllowServerId = "927050775073534012",
    allowServerName = "Nomi";

const messageLimit = 3;

function screenshot(serverId, channelId, messageId) {
    const image = http.request({
        url: api + "/messageScreenshot",
        method: "post",
        responseType: "arraybuffer",

        headers: {
            authorization: "Token " + token
        },

        data: { serverId, channelId, messageId }
    }).data;

    return image;
}

function bytesToString(bytes) {
    let str = "";

    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }

    return str;
}

function wrappedScreenshot(...args) {
    const data = screenshot(...args);
    if (data[0] !== "{".charCodeAt(0)) return [data, null];

    const parsedData = JSON.parse(bytesToString(data));
    if (!parsedData.error) return [null, null];

    const err = parsedData.data.message ?? parsedData.data.error;
    return [null, err ?? null];
}

let serverId = msg.guildId,
    channelId = msg.channelId,
    messageId = msg.reference?.messageId;

function main() {
    if (serverId !== alllowServerId) {
        return `:information_source: This tag only works in **${allowServerName}**.`;
    }

    if (typeof messageId === "undefined") {
        return ":information_source: You need to **reply** to a message in order to screenshot it.";
    }

    const messages = util.fetchMessages(),
        index = messages.findIndex(msg => msg.id === messageId);

    if (index !== -1) {
        const authorId = messages[index].authorId;

        let startIndex = index,
            endIndex = index;

        while (messages[startIndex - 1]?.authorId === authorId) startIndex--;
        while (messages[endIndex + 1]?.authorId === authorId) endIndex++;

        const block = messages.slice(startIndex, endIndex + 1);
        block.reverse();

        if (block.length > 1) {
            messageId = block.map(msg => msg.id).slice(0, messageLimit);
        }
    }

    const [imgData, err] = wrappedScreenshot(serverId, channelId, messageId);

    if (err !== null) {
        const period = err.endsWith(".") ? "" : ".";
        return `:warning: ${err}${period}`;
    }

    if (!imgData) return ":warning: No image recieved.";

    msg.reply({
        file: {
            name: "screenshot.png",
            data: imgData
        }
    });
}

if (typeof module !== "undefined") {
    module.exports = wrappedScreenshot;
} else {
    main();
}
