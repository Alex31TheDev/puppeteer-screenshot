const Util = Object.freeze({
    nonemptyString: str => {
        return typeof str === "string" && str.length > 0;
    },

    delay: ms => {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    },

    clamp: (x, a, b) => {
        return Math.max(Math.min(x, b), a);
    },

    getMessageUrl: (serverId, channelId, messageId) => `/channels/${serverId}/${channelId}/${messageId}`,
    getMessageSelector: (channelId, messageId) => `#chat-messages-${channelId}-${messageId}`,

    msToSec: ms => {
        return Math.round(ms / 1000);
    },

    isTimeoutError: err => {
        return err.name === "TimeoutError" || err.message.startsWith("Waiting for");
    }
});

export default Util;
