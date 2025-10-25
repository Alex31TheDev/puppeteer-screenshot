import path from "path";
import fs from "fs/promises";

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

import RE2 from "re2";

import config from "../config/config.js";
import logger from "../logger/logger.js";

import Util from "../util/Util.js";
import BufferUtil from "../util/BufferUtil.js";
import ImageUtil from "../util/ImageUtil.js";

import ScreenshotError from "../errors/ScreenshotError.js";

class PuppeteerService {
    static defaultWindow = {
        width: 1920,
        height: 1080,
        zoom: 1
    };

    static defaultDataDir = "./cache";
    static defaultArgs = ["--disable-gpu", "--no-sandbox"];

    static discordLoginUrl = "https://discord.com/login";

    static profilePictureClass = "c19a55";

    static rectSizeCap = 2 ** 15;
    static minMessageWidth = 500;

    static get profilePictureSelector() {
        return `.avatar_${this.profilePictureClass}.clickable_${this.profilePictureId}`;
    }

    static getLaunchArgs(args) {
        const launchArgs = this.defaultArgs.concat(args ?? []).map(arg => arg.trim());
        return Array.from(new Set(launchArgs));
    }

    constructor() {
        this._browser = null;
        this._dcontext = null;
        this._dpage = null;

        this.headless = config.headless;
        this.useNewNav = config.useNewNav;

        this.useCustomUserAgent = typeof config.userAgent === "string" && config.userAgent.length > 0;
        this.userAgent = config.userAgent;

        this.useCustomTimezone = typeof config.timezone === "string" && config.timezone.length > 0;
        this.timezone = config.timezone;

        this.window = {
            ...PuppeteerService.defaultWindow,
            ...config.window
        };

        this.userDataDir = path.resolve(config.userDataDir ?? PuppeteerService.defaultDataDir);
        this.args = PuppeteerService.getLaunchArgs(config.args);

        this.screenshotDir = path.resolve(process.cwd(), config.screenshotDir);

        this.useDiscord = typeof config.discordToken === "string" && config.discordToken.length > 0;
        this._discordToken = config.discordToken;

        if (this.useDiscord) {
            this.discordLoginTimeout = 30000;
            this.discordCrashCheckInterval = 5000;
            this.discordMessageTimeout = 2000;
        }
    }

    getScreenshotPath() {
        const filename = `screenshot_${Date.now()}.png`;
        return path.join(this.screenshotDir, filename);
    }

    async captureScreenshot(url, options = {}) {
        if (this._browser === null) {
            throw new ScreenshotError("Puppeteer browser is not initialized");
        } else if (!/^https?:\/\//.test(url)) {
            throw new ScreenshotError("Blocked navigation to non-web URL", url);
        }

        const { clip, scrollTo } = options;
        logger.info(`Capturing page: ${url}`);

        const filePath = this.getScreenshotPath(),
            screenshotOpts = {
                path: filePath,
                captureBeyondViewport: false,
                element: false
            };

        const useElementSelector = typeof scrollTo === "string";

        if (typeof clip === "object") {
            screenshotOpts.clip = clip;
            logger.info("Capturing specific area based on clip dimensions...");
        } else if (clip === "element") {
            if (!useElementSelector) {
                throw new ScreenshotError("No element selector provided");
            }

            screenshotOpts.element = true;
            logger.info("Capturing specific element based on scrollTo...");
        } else {
            screenshotOpts.fullPage = true;
            logger.info("Capturing the whole page as no clip was provided...");
        }

        const page = await this._browser.newPage();
        await this._setPageDefaults(page);

        await page.setRequestInterception(true);

        page.on("request", request => {
            const url = request.url();

            if (url.startsWith("file://")) {
                console.log("Blocked file URL:", url);
                request.abort();
            } else {
                request.continue();
            }
        });

        try {
            await page.goto(url, {
                waitUntil: "load",
                timeout: 2000
            });

            await this._setZoom(page);
        } catch (err) {
            await page.close();
            throw err;
        }

        let element;

        if (useElementSelector) {
            element = await page.$(scrollTo);

            if (!element) {
                await page.close();
                throw new ScreenshotError("Element not found");
            }

            await this._instantScroll(page, scrollTo);
            await Util.delay(500);
        }

        try {
            await (screenshotOpts.element ? element : page).screenshot(screenshotOpts);
        } finally {
            await page.close();
        }

        logger.info(`Screenshot saved at ${filePath}`);
        return filePath;
    }

    async captureMessageScreenshot(serverId, channelId, messageIds, options = {}) {
        if (this._dpage === null) {
            throw new ScreenshotError("Discord is not initialized");
        }

        if (!Array.isArray(messageIds)) messageIds = [messageIds];

        const multipleMessages = messageIds.length > 1,
            firstId = messageIds[0];

        const trim = options.trim ?? true;

        const sedOpts = options.sed,
            replaceContent = sedOpts !== null && typeof sedOpts === "object";

        const filePath = this.getScreenshotPath(),
            screenshotOpts = {
                type: "png",
                path: trim ? filePath : undefined,
                captureBeyondViewport: false
            };

        logger.info(`Locating message with ID: ${firstId}...`);

        const message = await this._navigateToMessage(serverId, channelId, firstId, {
            scrollToTop: multipleMessages
        });

        if (message !== null) {
            logger.info(`Message with ID ${firstId} was found.`);
        } else {
            throw new ScreenshotError(`Message with ID ${firstId} not found`, firstId);
        }

        let messageData = null,
            imageData = null,
            originalContent = null;

        if (this.useNewNav) {
            const messageSelectors = messageIds.map(id => Util.getMessageSelector(channelId, id));
            await this._hideExcept(this._dpage, messageSelectors);
        }

        if (replaceContent) {
            messageData = await this._fetchCachedMessage(channelId, firstId);
            ({ originalContent } = await this._replaceMessageContent(messageData, sedOpts));
            await Util.delay(200);
        }

        try {
            await this._setZoom(this._dpage);

            if (multipleMessages) {
                await Util.delay(300);

                screenshotOpts.clip = await this._getMessagesRect(message, channelId, messageIds);
                imageData = await this._dpage.screenshot(screenshotOpts);
            } else {
                imageData = await message.screenshot(screenshotOpts);
            }
        } finally {
            if (replaceContent) {
                await Util.delay(200);
                await this._setMessageContent(messageData, originalContent);
                messageData = originalContent = null;
            }
        }

        if (trim) {
            let image = ImageUtil.decodeImgData(imageData);
            image = this._trimMessageImage(image);
            ImageUtil.saveImgPNG(filePath, image);
        }

        logger.info(`Screenshot saved at ${filePath}`);

        const pfpRect = await this._getProfilePictureRect(message),
            encoded = BufferUtil.encodeObjectToBuffer(pfpRect);

        await fs.appendFile(filePath, encoded);
        return filePath;
    }

    async init() {
        if (this._browser !== null) {
            throw new ScreenshotError("Puppeteer browser is already initialized");
        }

        await this._launchPuppeteer();
        await this._initInnerSize();
        logger.info("Puppeteer browser launched.");

        await this._makeScreenshotDir();

        if (this.useDiscord) {
            await this._discordCreateContext();
            await this._discordLogin();
        }
    }

    async close() {
        if (this._browser === null) return;

        await this._browser.close();
        this._browser = null;

        this._dcontext = null;
        this._dpage = null;

        logger.info("Puppeteer browser closed.");
    }

    static _defaultSedFlags = "i";

    async _makeScreenshotDir() {
        await fs.mkdir(this.screenshotDir, { recursive: true });
    }

    async _launchPuppeteer() {
        const browserOpts = {
            headless: this.headless,
            userDataDir: this.userDataDir,
            defaultViewport: null,
            args: this.args
        };

        if (!browserOpts.headless) {
            browserOpts.args.push(
                browserOpts.fullscreen
                    ? "--start-maximized"
                    : `--window-size=${this.window.width},${this.window.height}`
            );
        }

        this.browserOpts = browserOpts;
        this._browser = await puppeteer.launch(browserOpts);
    }

    async _setPageDefaults(page) {
        if (this.useCustomUserAgent) await page.setUserAgent(this.userAgent);

        if (this.headless) {
            await page.setViewport({
                width: this.window.width,
                height: this.window.height
            });
        }

        if (this.useCustomTimezone) await page.emulateTimezone(this.timezone);
    }

    async _initInnerSize() {
        let innerSize;

        if (this.headless) {
            innerSize = {
                innerWidth: this.window.width,
                innerHeight: this.window.height
            };
        } else {
            const page = await this._browser.newPage();
            await this._setPageDefaults(page);

            innerSize = await page.evaluate(() => {
                /* eslint-disable */

                return {
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight
                };

                /* eslint-enable */
            });

            await page.close();
        }

        this.window = {
            ...this.window,
            ...innerSize
        };
    }

    async _setZoom(page) {
        if (this.window.zoom === 1) return;

        await page.evaluate(zoom => {
            /* eslint-disable */

            document.body.style.zoom = zoom;

            /* eslint-enable */
        }, this.window.zoom);
    }

    async _discordCreateContext() {
        this._dcontext = await this._browser.createBrowserContext();
        logger.info("Created discord context.");
    }

    async _discordCreatePage() {
        this._dpage = await this._dcontext.newPage();
        await this._setPageDefaults(this._dpage);

        await this._discordPreloadPatches();
    }

    async _discordNavigateToLogin() {
        logger.info("Navigating to Discord login page...");

        try {
            await this._dpage.goto(PuppeteerService.discordLoginUrl, {
                waitUntil: "networkidle2",
                timeout: 0
            });
        } catch (err) {
            logger.error("Discord navigation failed with error:", err);
            throw err;
        }
    }

    async _discordWaitForLogin() {
        logger.info("Waiting for homepage...");

        try {
            await this._dpage.waitForSelector('[data-list-item-id="guildsnav___home"]', {
                timeout: this.discordLoginTimeout
            });

            logger.info("Logged into Discord successfully.");
        } catch (err) {
            if (Util.isTimeoutError(err)) {
                logger.error(`Discord login failed. (${Util.msToSec(this.discordLoginTimeout)}s timeout exceeded)
The provided Discord token is likely invalid. Try updating it then restarting.`);
            } else {
                logger.error("Discord login failed with error:", err);
            }

            throw err;
        }
    }

    async _discordWaitForLoading() {
        try {
            await this._dpage.waitForFunction(
                () => {
                    /* eslint-disable */

                    return typeof window.webpackChunkdiscord_app !== "undefined";

                    /* eslint-enable */
                },
                {
                    timeout: 5000,
                    polling: 100
                }
            );

            return true;
        } catch (err) {
            if (Util.isTimeoutError(err)) return false;
            else throw err;
        }
    }

    async _discordReloadPage() {
        logger.info("Reloading Discord page...");

        try {
            await this._dpage.reload();
        } catch (err) {
            logger.error("Discord navigation failed with error:", err);
            throw err;
        }

        await this._discordLoadingPatches();
    }

    async _discordPreloadPatches() {
        logger.debug("Applying Discord preload patches...");

        await this._dpage.evaluateOnNewDocument(() => {
            /* eslint-disable */

            Object.defineProperty(window, "__s_localStorage", {
                value: localStorage,
                configurable: false,
                enumerable: false,
                writable: true
            });

            /* eslint-enable */
        });
    }

    async _discordLoadingPatches() {
        if (!(await this._discordWaitForLoading())) return;

        logger.debug("Applying Discord loading patches...");

        await this._dpage.evaluate(() => {
            /* eslint-disable */

            const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
            webpackChunkdiscord_app.pop();

            window.__s_wpRequire = id => {
                if (id == null) return undefined;
                else return wpRequire(id);
            };

            window.__s_findModule = cb => {
                const cache = Object.entries(wpRequire.c),
                    _module = cache.find(([, value]) => Boolean(cb(value?.exports)));

                return _module?.[0] ?? null;
            };

            /* eslint-enable */
        });

        await this._dpage.evaluate(() => {
            /* eslint-disable */

            const dispatcher = __s_wpRequire(__s_findModule(_exports => _exports?.Wb?._handleDispatch))?.Wb;
            if (dispatcher != null) window.__s_handleDispatch = dispatcher._handleDispatch.bind(dispatcher);

            window.__s_channelCache = __s_wpRequire(89892)?.Z;

            /* eslint-enable */
        });
    }

    async _discordSetToken() {
        logger.debug("Setting Discord token in localStorage...");

        await this._dpage.evaluate(token => {
            /* eslint-disable */

            window.__s_localStorage.setItem("token", `"${token}"`);

            /* eslint-enable */
        }, this._discordToken);
    }

    async _discordLogin() {
        await this._discordCreatePage();

        await this._discordNavigateToLogin();
        await this._discordSetToken();

        logger.info("Reloading page to authenticate...");
        await this._discordReloadPage();
        await this._discordWaitForLogin();

        this._setDiscordCrashCheckInterval();
    }

    async _instantScroll(page, selector) {
        await page.evaluate(selector => {
            /* eslint-disable */

            const element = document.querySelector(selector);
            element.scrollIntoView({ behavior: "instant", block: "start" });

            /* eslint-enable */
        }, selector);
    }

    async _hideExcept(page, selectors) {
        if (!Array.isArray(selectors)) selectors = [selectors];

        await page.evaluate(selectors => {
            /* eslint-disable */

            document.querySelectorAll("body *").forEach(element => {
                const isTarget = selectors.some(sel => element.matches(sel)),
                    isChildOfTarget = selectors.some(sel => element.closest(sel)),
                    isAncestorOfTarget = selectors.some(sel => element.querySelector(sel));

                if (!isTarget && !isChildOfTarget && !isAncestorOfTarget) element.style.display = "none";
            });

            /* eslint-enable */
        }, selectors);
    }

    async _discordHideChatElements() {
        await this._dpage.evaluate(() => {
            /* eslint-disable */

            const newMessages = document.querySelector('[class^="newMessagesBar"]');
            if (newMessages) newMessages.style.display = "none";

            const messagesWrapper = document.querySelector('[class^="messagesWrapper"]'),
                chatBox = messagesWrapper.nextElementSibling;

            if (chatBox) chatBox.style.display = "none";

            /* eslint-enable */
        });
    }

    async _discordHideFlashes() {
        await this._dpage.evaluate(() => {
            /* eslint-disable */

            const flashes = document.querySelectorAll('[class^="flash"]');

            for (const flash of flashes) {
                const message = flash.firstElementChild;

                if (message) {
                    flash.parentNode.insertBefore(message, flash.nextElementSibling);

                    flash.removeChild = () => {};
                    flash.appendChild(document.createElement("div"));
                }
            }

            /* eslint-enable */
        });
    }

    async _navigateToTarget(targetUrl) {
        logger.debug(`Navigating to URL: ${targetUrl}`);

        await this._dpage.evaluate(targetUrl => {
            /* eslint-disable */

            if (window.location.pathname !== targetUrl) {
                window.history.pushState(null, "", targetUrl);
                window.history.pushState(null, "", null);

                window.history.go(-1);
            }

            /* eslint-enable */
        }, targetUrl);
    }

    async _navigateToMessage(serverId, channelId, messageId, options = {}) {
        const targetUrl = Util.getMessageUrl(serverId, channelId, messageId),
            messageSelector = Util.getMessageSelector(channelId, messageId);

        const scrollToTop = options.scrollToTop ?? false;

        logger.info(`Navigating to server: ${serverId}, channel: ${channelId}, message: ${messageId}`);
        await this._navigateToTarget(targetUrl);

        try {
            await this._dpage.waitForSelector(messageSelector, {
                timeout: this.discordMessageTimeout
            });
        } catch (err) {
            if (Util.isTimeoutError(err)) return null;
            else throw err;
        }

        if (!this.useNewNav) await this._discordHideChatElements();
        await this._discordHideFlashes();

        if (scrollToTop) {
            await this._instantScroll(this._dpage, messageSelector);
        }

        await Util.delay(this.useNewNav ? 500 : 1500);
        return await this._dpage.$(messageSelector);
    }

    async _fetchCachedMessage(channelId, messageId) {
        const data = await this._dpage.evaluate(
            (channelId, messageId) => {
                /* eslint-disable */

                const messageCache = __s_channelCache.get(channelId);
                return messageCache.get(messageId) ?? null;

                /* eslint-enable */
            },
            channelId,
            messageId
        );

        if (data === null) {
            throw new ScreenshotError("Cached message not found", { channelId, messageId });
        }

        return data;
    }

    async _setMessageContent(data, newContent) {
        if (data === null || !Util.nonemptyString(newContent)) return;

        await this._dpage.evaluate(
            (data, newContent) => {
                /* eslint-disable */

                data.content = newContent;
                __s_handleDispatch(data, "MESSAGE_UPDATE", {});

                /* eslint-enable */
            },
            data,
            newContent
        );
    }

    async _replaceMessageContent(data, options = {}) {
        if (data === null) return { originalContent: null, newContent: null };

        let { regex: regexStr, flags: flagsStr, replace } = options;
        flagsStr ||= PuppeteerService._defaultSedFlags;

        let regex = null;

        try {
            regex = new RE2(regexStr, flagsStr);
        } catch (err) {
            if (err instanceof SyntaxError) {
                throw new ScreenshotError("Invalid regex or flags", { regexStr, flagsStr });
            }

            throw err;
        }

        let originalContent = data.content,
            newContent = null;

        if (!regex.test(originalContent)) {
            throw new ScreenshotError("No matching text found", {
                regex,
                content: originalContent
            });
        } else newContent = originalContent.replace(regex, replace);

        if (newContent.length < 1) {
            throw new ScreenshotError("Can't edit with empty content");
        }

        await this._setMessageContent(data, newContent);
        return { originalContent, newContent };
    }

    async _getMessagesRect(element, channelId, messageIds) {
        const elements = [element];

        for (const id of messageIds.slice(1)) {
            const messageSelector = Util.getMessageSelector(channelId, id);
            elements.push(await this._dpage.$(messageSelector));
        }

        let boundingBoxes = await Promise.all(elements.map(element => element?.boundingBox()));
        boundingBoxes = boundingBoxes.filter(Boolean);

        if (boundingBoxes.length === 0) {
            throw new ScreenshotError("No valid bounding boxes found for the messages");
        }

        const minX = Math.min(...boundingBoxes.map(box => box.x)),
            minY = Math.min(...boundingBoxes.map(box => box.y)),
            maxX = Math.max(...boundingBoxes.map(box => box.x + box.width)),
            maxY = Math.max(...boundingBoxes.map(box => box.y + box.height));

        const width = maxX - minX,
            height = maxY - minY,
            windowHeight = this.window.height;

        if (maxY > windowHeight) {
            throw new ScreenshotError("Messages too tall, they don't fit in the browser window", {
                maxY,
                windowHeight
            });
        }

        return {
            x: Math.floor(minX),
            y: Math.floor(minY),
            width: Math.floor(width),
            height: Math.floor(height)
        };
    }

    _trimMessageImage(image) {
        const bg = ImageUtil.readImgPixel(image, 0, 0),
            last = ImageUtil.readImgPixel(image, 0, image.height - 1);

        if (!ImageUtil.pixelsMatch(bg, last)) image.height--;

        const trim = ImageUtil.findTrim(image, {
            treshold: 3,
            background: bg
        });

        const newWidth = Math.max(trim.left + trim.right + 2, PuppeteerService.minMessageWidth);

        return ImageUtil.clip(image, {
            left: 0,
            top: 0,
            right: newWidth,
            bottom: image.height - 1
        });
    }

    async _getProfilePictureRect(message) {
        let x = 0,
            y = 0;

        let width = 0,
            height = 0;

        const pfp = await message.$(PuppeteerService.profilePictureSelector);

        if (pfp) {
            const messageBox = await message.boundingBox(),
                pfpBox = await pfp.boundingBox();

            x = pfpBox.x - messageBox.x;
            y = pfpBox.y - messageBox.y;

            ({ width, height } = pfpBox);
        }

        const cap = PuppeteerService.rectSizeCap;

        return {
            x: Math.floor(Util.clamp(x, -cap, cap)),
            y: Math.floor(Util.clamp(y, -cap, cap)),
            width: Math.floor(Util.clamp(width, -cap, cap)),
            height: Math.floor(Util.clamp(height, -cap, cap))
        };
    }

    async _discordCrashed() {
        const errorPage = await this._dpage.$('[class*="errorPage"]');
        return Boolean(errorPage);
    }

    _setDiscordCrashCheckInterval() {
        const _this = this;

        this._discordCrashCheckTimer = setInterval(async () => {
            if (!(await _this._discordCrashed())) return;
            logger.info("Discord page crashed.");

            try {
                await _this._discordReloadPage();
            } catch (err) {
                _this._clearDiscordCrashCheckInterval();
            }
        }, this.discordCrashCheckInterval);
    }

    _clearDiscordCrashCheckInterval() {
        if (typeof this._discordCrashCheckTimer === "undefined") {
            return;
        }

        clearInterval(this._discordCrashCheckTimer);
        delete this._discordCrashCheckTimer;
    }
}

export default PuppeteerService;
