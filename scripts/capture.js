"use strict";

const api = "http://[IP_ADDRESS]",
    token = "";

const sedTags = ["g:better-better-sed", "g:bbsed", "g:bbs"];

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
    const data = {
        serverId,
        channelId,
        messageId: messageIds,
        trim
    };

    if (sedOpts !== null) {
        data.sed = sedOpts;
    }

    const res = http.request({
        url: api + "/messageScreenshot",
        method: "post",
        responseType: "arraybuffer",

        headers: {
            authorization: "Bearer " + token
        },

        data
    });

    const image = res.data,
        body = image instanceof ArrayBuffer ? new Uint8Array(image) : image,
        pfpHeader = res.headers["x-profile-picture-rect"];

    let pfpRect = null;

    if (pfpHeader) {
        try {
            pfpRect = JSON.parse(pfpHeader);
        } catch {
            pfpRect = null;
        }
    }

    return [body, pfpRect];
}

function wrappedScreenshot(...args) {
    const [data, pfpRect] = screenshot(...args);
    if (data[0] !== "{".charCodeAt(0)) return [data, null, pfpRect];

    const parsedData = JSON.parse(bytesToString(data));
    if (!parsedData?.error) return [null, null, null];

    return [null, parsedData.error, null];
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
    realTag = util.fetchTag(tagName);

const isSedCall = realTag.hops.some(hop => sedTags.includes(hop));

const sedRegex =
    /(?:^(?:sed)?\/|\s+(?:sed)?\/)(?<regex_text>(?:\\.|[^/])+)\/(?<replace>(?:\\.|[^/])*)\/?(?<flags_text>(?:\\.|[^/])+?)?(?=\s|$)/gi;

const defaultFlags = "i",
    flagsRegex = /^[gimsuy]*$/;

const usage1 = "Please provide a replacement string, e.g., `/find/replace`",
    usage2 = "Please use `/find/replace` or `/find/replace/flags`";

function parsePattern(str = "") {
    return str.replace(/^`{1,3}|`{1,3}$/g, "").replaceAll("\\/", "/");
}

function validFlags(flags) {
    return flagsRegex.test(flags) && new Set(flags).size === flags.length;
}

function parseRule(match, i, singleRule) {
    if (!match.groups) {
        return [null, `:warning: Encountered invalid args.\n${usage2}`];
    }

    const regexText = parsePattern(match.groups.regex_text),
        replace = parsePattern(match.groups.replace);

    const rawFlags = match.groups.flags_text ?? defaultFlags,
        flags = parsePattern(rawFlags).toLowerCase();

    const expStr = !singleRule && typeof i === "number" ? ` for expression **${i + 1}**` : "";

    if (!validFlags(flags)) {
        return [null, `:warning: Invalid regex flags${expStr}.\n${usage2}`];
    }

    try {
        new RegExp(regexText, flags);
    } catch {
        return [null, `:warning: Invalid regex or flags${expStr}.\n${usage2}`];
    }

    return [{ regex: regexText, replace, flags }, null];
}

function parseSedArgs() {
    if (!tag.args) {
        return [null, `:information_source: ${usage1}`];
    }

    const matches = Array.from(tag.args.matchAll(sedRegex));

    if (matches.length === 0) {
        return [null, `:warning: Encountered invalid args.\n${usage2}`];
    }

    const singleRule = matches.length === 1,
        rules = [];

    for (let i = 0; i < matches.length; i++) {
        const [rule, err] = parseRule(matches[i], i, singleRule);
        if (err !== null) return [null, err];

        rules.push(rule);
    }

    return [singleRule ? rules[0] : rules, null];
}

let serverId = msg.guildId,
    channelId = msg.channelId,
    messageId = msg.reference?.messageId;

function main() {
    if (serverId !== allowServerId) {
        return `:information_source: This tag only works in **${allowServerName}**.`;
    } else if (typeof messageId === "undefined") {
        const action = isSedCall ? "sed replace" : "screenshot";
        return `:information_source: You need to **reply** to a message in order to **${action}** it.`;
    }

    let sedOpts = null;

    if (isSedCall) {
        let err;
        [sedOpts, err] = parseSedArgs();

        if (err !== null) return err;
    }

    const messageIds = getMessageWindow(messageId);

    {
        const [imgData, err] = wrappedScreenshot(serverId, channelId, messageIds, sedOpts);

        if (err !== null) {
            if (err === "No matching text found") {
                return `:no_entry_sign: ${err}.\n${usage2}`;
            }

            const period = err.endsWith(".") ? "" : ".";

            return `:warning: ${err}${period}`;
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
