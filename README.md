# Puppeteer Screenshot Service

An authenticated HTTP service for capturing web pages and, optionally, Discord messages.

## Setup

1. Copy `config/users.example.json` to `config/users.json`, then generate a bcrypt hash with `npm run password -- <username> <password>`.
2. Copy `config/auth.example.json` to `config/auth.json`, then generate a key with `npm run secret` and set `jwtSecret` (minimum 32 characters).
3. Optionally set `discordToken` in `config/auth.json` to enable `POST /messageScreenshot`.
4. Run `npm start`.

`config/config.json` contains non-secret settings. Page screenshots permit only public HTTP(S) targets by default; set `allowPrivateNetwork` only for a trusted internal deployment.

## API

`POST /login` accepts `{ "username", "password" }` and returns `{ "token" }`. Send that token as `Authorization: Bearer <token>`.

`POST /screenshot` accepts `{ "url", "clip?", "scrollTo?" }`. `clip` is either `{ "x", "y", "width", "height" }` or `"element"` (which requires `scrollTo`).

`POST /messageScreenshot` accepts `{ "serverId", "channelId", "messageId", "trim?", "sed?" }` when Discord is configured. It returns a valid PNG and includes `X-Profile-Picture-Rect` when available.
