const Util = Object.freeze({
    delay: ms => {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    },

    clamp: (x, a, b) => {
        return Math.max(Math.min(x, b), a);
    },

    getMessageUrl: (serverId, channelId, messageId) => `/channels/${serverId}/${channelId}/${messageId}`,
    getMessageSelector: (channelId, messageId) => `#chat-messages-${channelId}-${messageId}`
});

export default Util;
