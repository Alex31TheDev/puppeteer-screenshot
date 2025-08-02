function wrapRequest(_, res, next) {
    const originalSend = res.send;

    res.send = function (body) {
        const code = res.statusCode || 200,
            contentType = res.get("Content-Type") || "";

        if (code < 200 || code >= 300) {
            res.status(200);
            let responseBody = body;

            if (typeof body === "string") {
                if (contentType.includes("application/json")) {
                    try {
                        responseBody = JSON.parse(body);
                    } catch (err) {}
                } else {
                    responseBody = { message: body };
                }
            }

            return originalSend.call(this, {
                error: true,
                code: code,
                data: responseBody
            });
        }

        return originalSend.call(this, body);
    };

    next();
}

export default wrapRequest;
