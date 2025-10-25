"use strict";

const api = "http://37.27.51.247:7777",
    token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InVzZXIiLCJsYXN0VXBkYXRlZCI6ImZmOTIwMzY4YzYwZWZmYTZiYzIxMTIzYzBmMjMxNTU2IiwiaWF0IjoxNzYxMjQwMzgzLCJleHAiOjE3NjM4MzIzODN9.DDfnNGkwVU-XF1wAcf1tPKC25FKL-Iyv8nJBVvn5LFE";

const allowServerId = "927050775073534012",
    allowServerName = "Nomi";

const trim = true,
    messageLimit = 3;

function bytesToString(bytes) {
    let str = "";

    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }

    return str;
}

function screenshot(serverId, channelId, messageIds, sedOpts) {
    const image = http.request({
        url: api + "/messageScreenshot",
        method: "post",
        responseType: "arraybuffer",

        headers: {
            authorization: "Token " + token
        },

        data: {
            serverId,
            channelId,
            messageId: messageIds,
            trim,
            sed: sedOpts
        }
    }).data;

    return image instanceof ArrayBuffer ? new Uint8Array(image) : image;
}

function wrappedScreenshot(...args) {
    const data = screenshot(...args);
    if (data[0] !== "{".charCodeAt(0)) return [data, null, null];

    const parsedData = JSON.parse(bytesToString(data));
    if (!parsedData?.error) return [null, null, null];

    const err = parsedData.data?.message ?? parsedData.data?.error ?? null,
        details = parsedData.data?.details ?? null;

    return [null, err, details];
}

function getMessageWindow(messageId, limit) {
    limit ??= messageLimit;

    const messages = util.fetchMessages(),
        result = [messageId];

    let index = messages.findIndex(msg => msg.id === messageId);
    if (index === -1) return result;

    const authorId = messages[index].authorId;

    let start = index,
        end = index;

    while (messages[start - 1]?.authorId === authorId) start--;
    while (messages[end + 1]?.authorId === authorId) end++;

    const block = messages.slice(start, end + 1).map(msg => msg.id);
    index = block.indexOf(messageId);

    start = index - 1;
    end = index + 1;

    while ((start >= 0 || end < block.length) && result.length < limit) {
        if (block[end] != null && result.length < limit) {
            result.push(block[end]);
            end++;
        }

        if (block[start] != null && result.length < limit) {
            result.push(block[start]);
            start--;
        }
    }

    return result;
}

const tagName = msg.content.split(" ")[1],
    sedTag = ["better-better-sed", "bbsed", "bbs"].includes(tagName);

const sedRegex = /^\/((?:\\\/|[^/])+)\/((?:\\\/|[^/])*)(?:\/([gimsuy]*))?$/s,
    usage1 = "Please provide a replacement string, e.g., `/find/replace`",
    usage2 = "Please use `/find/replace` or `/find/replace/flags`";

function parseSedArgs() {
    if (!tag.args) {
        return [null, `:information_source: ${usage1}`];
    }

    const match = tag.args.match(sedRegex);

    if (!match) {
        return [null, `:warning: Encountered invalid args.\n${usage2}`];
    }

    const [, regex, replace, flags] = match,
        regexUnescaped = regex.replace(/\\\//g, "/"),
        replaceUnescaped = replace.replace(/\\\//g, "/");

    const sedOpts = {
        regex: regexUnescaped,
        replace: replaceUnescaped,
        flags
    };

    return [sedOpts, null];
}

let serverId = msg.guildId,
    channelId = msg.channelId,
    messageId = msg.reference?.messageId;

function main() {
    if (serverId !== allowServerId) {
        return `:information_source: This tag only works in **${allowServerName}**.`;
    } else if (typeof messageId === "undefined") {
        const action = sedTag ? "sed replace" : "screenshot";
        return `:information_source: You need to **reply** to a message in order to **${action}** it.`;
    }

    let sedOpts = null;

    if (sedTag) {
        let err;
        [sedOpts, err] = parseSedArgs();

        if (err !== null) return err;
    }

    const messageIds = getMessageWindow(messageId);

    {
        const [imgData, err, details] = wrappedScreenshot(serverId, channelId, messageIds, sedOpts);

        if (err !== null) {
            if (details === "No matching text found") {
                return `:no_entry_sign: ${details}.\n${usage2}`;
            }

            const errMsg = `${err}: ${details}`,
                period = err.endsWith(".") ? "" : ".";

            return `:warning: ${errMsg}${period}`;
        }

        if (!imgData) return ":no_entry_sign: No image recieved.";

        msg.reply({
            file: {
                name: "screenshot.png",
                data: imgData
            }
        });
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        getMessageWindow,
        capture: wrappedScreenshot
    };
} else {
    main();
}
