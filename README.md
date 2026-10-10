# Puppeteer Screenshot Service

HTTP service for capturing web pages and Discord messages.

## Setup

1. Copy `config/users.example.json` to `config/users.json` and generate a user:
    ```bash
    npm run password -- <username> <password>
    ```
2. Copy `config/auth.example.json` to `config/auth.json` and generate a JWT secret:
    ```bash
    npm run secret
    ```
    Set `jwtSecret` in `config/auth.json` (at least 32 characters).
3. (Optional) To enable `/messageScreenshot`, set `discordToken` in `config/auth.json` to a Discord user token.
4. Start the server:
    ```bash
    npm start
    ```

## API

All endpoints except `POST /login` require the header:

```http
Authorization: Bearer <token>
```

### `POST /login`

Authenticates a user and returns a JWT token.

**Request body:**

```json
{
    "username": "user",
    "password": "password"
}
```

**Response (`200 OK`):**

```json
{
    "token": "<jwt_token>"
}
```

---

### `POST /screenshot`

Captures a screenshot of a webpage. Target URLs must use `http` or `https` and cannot point to private IP ranges unless `allowLocalhostRequests` is enabled in `config/config.json`.

**Request body:**

```json
{
    "url": "https://example.com",
    "scrollTo": "#target-element",
    "clip": {
        "x": 0,
        "y": 0,
        "width": 800,
        "height": 600
    }
}
```

- `url` (string, required): Target URL to capture.
- `scrollTo` (string, optional): CSS selector to scroll into view before capturing.
- `clip` (object | `"element"`, optional):
    - Object with `{ x, y, width, height }` (numbers).
    - Or the string `"element"`, which clips the bounding box of the element matched by `scrollTo`.

**Response (`200 OK`):**

- Returns the image as `image/png`.

---

### `POST /messageScreenshot`

Available when `discordToken` is set in `config/auth.json`. Navigates to a Discord channel, locates the target message(s), and captures a screenshot.

**Request body:**

```json
{
    "serverId": "927050775073534012",
    "channelId": "927073124086849577",
    "messageId": "1557505274879803555",
    "trim": true,
    "sed": {
        "regex": "foo",
        "replace": "bar",
        "flags": "i"
    }
}
```

- `serverId` (string, required): Discord server ID.
- `channelId` (string, required): Discord channel ID.
- `messageId` (string | string[], required): A single message ID or an array of contiguous message IDs (up to 25). `messageIds` is also accepted as an alias.
- `trim` (boolean, optional, default `true`): Trims surrounding transparent and solid-color background padding down to the message content.
- `sed` (object, optional): Replaces text in the message DOM via Discord's internal update dispatcher before capturing, then reverts it afterwards:
    - `regex` (string, required): RE2 regular expression to match against the message text.
    - `replace` (string, required): Replacement text.
    - `flags` (string, optional, default `"i"`): Regex flags (e.g. `"g"`, `"i"`, `"m"`).

**Response (`200 OK`):**

- Body: PNG image.
- Header `X-Profile-Picture-Rect` (JSON string, optional): Bounding box `{ x, y, width, height }` of the avatar relative to the screenshot image (for overlaying or masking).

---

## Configuration

Settings in `config/config.json`:

- `port` (number, default: `3000`): Port for the HTTP server.
- `logLevel` (string, default: `"info"`): Logging level (`error`, `warn`, `info`, `debug`).
- `screenshotDir` (string, default: `"./screenshots"`): Temporary directory where screenshots are written.
- `userDataDir` (string, default: `"./cache"`): Puppeteer browser user data / cache directory.
- `headless` (boolean, default: `true`): Run Chrome in headless mode.
- `navigationTimeout` (number, default: `15000`): Navigation timeout in ms for standard web pages.
- `discordLoginTimeout` (number, default: `30000`): Timeout in ms waiting for Discord login on startup.
- `discordMessageTimeout` (number, default: `5000`): Timeout in ms waiting for Discord message selector.
- `retryTimeout` (number, default: `5000`): Timeout in ms for navigation retry attempts.
- `retryDelay` (number, default: `500`): Delay in ms between failed navigation retries and requests.
- `allowLocalhostRequests` (boolean, default: `false`): Allow requests to loopback and RFC 1918 addresses.
- `window.width` (number, default: `1920`): Browser viewport width.
- `window.height` (number, default: `1080`): Browser viewport height.
- `window.zoom` (number, default: `1`): Page zoom scale.

## Client Tag Script

`scripts/capture.js` is an integration script designed for Discord bot tags (e.g. `el-levert`) to request screenshots from this service.

To build the minified tag version:

```bash
npm run minify-capture-tag
```

Outputs to `scripts/capture.min.js`.
