import path from "path";
import fsPromises from "fs/promises";

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());

import logger from "../logger/logger.js";
import Util from "../util/Util.js";
import BufferUtil from "../util/BufferUtil.js";

import CustomError from "../errors/CustomError.js";

import config from "../config/config.js";

const defaultWidth = 1920,
    defaultHeight = 1080,
    defaultZoom = 1;

const userDataDir = "./cache",
    defaultArgs = ["--disable-gpu", "--no-sandbox"];

const discordLoginUrl = "https://discord.com/login";
const profilePictureSelector = ".avatar_f9f2ca.clickable_f9f2ca";

class PuppeteerService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;

        this.headless = config.headless;
        this.useNewNav = config.useNewNav;

        this.useCustomUserAgent = typeof config.userAgent === "string" && config.userAgent.length > 0;
        this.userAgent = config.userAgent;

        this.useCustomTimezone = typeof config.timezone === "string" && config.timezone.length > 0;
        this.timezone = config.timezone;

        this.window = config.window;
        this.window.width ??= defaultWidth;
        this.window.height ??= defaultHeight;
        this.window.zoom ??= defaultZoom;

        this.screenshotDir = path.resolve(process.cwd(), config.screenshotDir);

        this.useDiscord = typeof config.discordToken === "string" && config.discordToken.length > 0;
        this.discordToken = config.discordToken;
    }

    getScreenshotPath() {
        const filename = `screenshot_${Date.now()}.png`;
        return path.join(this.screenshotDir, filename);
    }

    async captureScreenshot(url, clip, scrollTo) {
        if (this.browser === null) {
            throw new CustomError("Puppeteer browser is not initialized");
        }

        if (!/^https?:\/\//.test(url)) {
            throw new CustomError(`Blocked navigation to web URL`);
        }

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
                throw new CustomError("No element selector provided");
            }

            screenshotOpts.element = true;
            logger.info("Capturing specific element based on scrollTo...");
        } else {
            screenshotOpts.fullPage = true;
            logger.info("Capturing the whole page as no clip was provided...");
        }

        const page = await this.browser.newPage();
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
                throw new CustomError("Element not found");
            }

            await this._instantScroll(page, scrollTo);
            await Util.delay(500);
        }

        try {
            if (screenshotOpts.element) {
                await element.screenshot(screenshotOpts);
            } else {
                await page.screenshot(screenshotOpts);
            }
        } finally {
            await page.close();
        }

        logger.info(`Screenshot saved at ${filePath}`);
        return filePath;
    }

    async captureMessageScreenshot(serverId, channelId, messageIds) {
        if (this.page === null) {
            throw new CustomError("Discord is not initialized.");
        }

        const filePath = this.getScreenshotPath(),
            screenshotOpts = {
                path: filePath,
                captureBeyondViewport: false
            };

        if (!Array.isArray(messageIds)) messageIds = [messageIds];

        const multipleMessages = messageIds.length > 1,
            firstId = multipleMessages ? messageIds[0] : messageIds;

        logger.info(`Locating message with ID: ${firstId}...`);

        const element = await this._navigateToMessage(serverId, channelId, firstId, {
            scrollToTop: multipleMessages
        });

        if (this.useNewNav) {
            const messageSelectors = messageIds.map(id => Util.getMessageSelector(channelId, id));
            await this._hideExcept(this.page, messageSelectors);
        }

        if (element) {
            logger.info(`Message with ID ${firstId} was found.`);
        } else {
            throw new CustomError(`Message with ID ${firstId} not found.`);
        }

        await this._setZoom(this.page);

        if (multipleMessages) {
            await Util.delay(300);

            screenshotOpts.clip = await this._getMessagesRect(element, channelId, messageIds);
            await this.page.screenshot(screenshotOpts);
        } else {
            await element.screenshot(screenshotOpts);
        }

        logger.info(`Screenshot saved at ${filePath}`);

        const pfpRect = await this._getProfilePictureRect(element),
            encoded = BufferUtil.encodeObjectToBuffer(pfpRect);

        await fsPromises.appendFile(filePath, encoded);
        return filePath;
    }

    async init() {
        if (this.browser !== null) {
            throw new CustomError("Puppeteer browser is already initialized.");
        }

        await this._launchPuppeteer();
        await this._initInnerSize();
        logger.info("Puppeteer browser launched.");

        await this._makeScreenshotDir();

        if (this.useDiscord) {
            await this._createDiscordContext();
            await this._discordLogin();
        }
    }

    async close() {
        if (this.browser === null) {
            return;
        }

        await this.browser.close();
        this.browser = null;

        logger.info("Puppeteer browser closed.");
    }

    async _makeScreenshotDir() {
        await fsPromises.mkdir(this.screenshotDir, { recursive: true });
    }

    async _launchPuppeteer() {
        const browserOpts = {
            headless: this.headless,
            userDataDir,
            defaultViewport: null,
            args: defaultArgs
        };

        if (!browserOpts.headless) {
            if (browserOpts.fullscreen) {
                browserOpts.args.push("--start-maximized");
            } else {
                browserOpts.args.push(`--window-size=${this.window.width},${this.window.height}`);
            }
        }

        this.browserOpts = browserOpts;
        this.browser = await puppeteer.launch(browserOpts);
    }

    async _setPageDefaults(page) {
        if (this.useCustomUserAgent) {
            await page.setUserAgent(this.userAgent);
        }

        if (this.headless) {
            await page.setViewport({
                width: this.window.width,
                height: this.window.height
            });
        }

        if (this.useCustomTimezone) {
            await page.emulateTimezone(this.timezone);
        }
    }

    async _initInnerSize() {
        let innerSize;

        if (this.headless) {
            innerSize = {
                innerWidth: this.window.width,
                innerHeight: this.window.height
            };
        } else {
            const page = await this.browser.newPage();
            await this._setPageDefaults(page);

            /* eslint-disable */
            innerSize = await page.evaluate(() => {
                return {
                    innerWidth: window.innerWidth,
                    innerHeight: window.innerHeight
                };
            });
            /* eslint-enable */

            await page.close();
        }

        this.window = {
            ...this.window,
            ...innerSize
        };
    }

    async _setZoom(page) {
        if (this.window.zoom === 1) return;

        /* eslint-disable */
        await page.evaluate(zoom => {
            document.body.style.zoom = zoom;
        }, this.window.zoom);
        /* eslint-enable */
    }

    async _createDiscordContext() {
        this.context = await this.browser.createBrowserContext();
        logger.info("Created discord context.");
    }

    async _discordLogin() {
        logger.info("Navigating to Discord login page...");
        const page = await this.context.newPage();
        await this._setPageDefaults(page);

        /* eslint-disable */
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(window, "backupLocalStorage", {
                value: localStorage,
                writable: true
            });
        });
        /* eslint-enable */

        await page.goto(discordLoginUrl, { waitUntil: "networkidle2" });
        logger.info("Setting Discord token in localStorage...");

        /* eslint-disable */
        await page.evaluate(token => {
            backupLocalStorage.setItem("token", `"${token}"`);
        }, this.discordToken);
        /* eslint-enable */

        logger.info("Refreshing page to authenticate...");

        try {
            await page.reload();
            await page.waitForSelector('[data-list-item-id="guildsnav___home"]', { timeout: 10000 });
        } catch (err) {
            logger.error("Login failed.");
            throw err;
        }

        logger.info("Logged into Discord successfully.");
        this.page = page;

        this._setCrashCheckInterval();
    }

    async _instantScroll(page, selector) {
        /* eslint-disable */
        await page.evaluate(selector => {
            const element = document.querySelector(selector);
            element.scrollIntoView({ behavior: "instant", block: "start" });
        }, selector);
        /* eslint-enable */
    }

    async _hideExcept(page, selectors) {
        if (!Array.isArray(selectors)) selectors = [selectors];

        /* eslint-disable */
        await page.evaluate(selectors => {
            document.querySelectorAll("body *").forEach(element => {
                const isTarget = selectors.some(sel => element.matches(sel)),
                    isChildOfTarget = selectors.some(sel => element.closest(sel)),
                    isAncestorOfTarget = selectors.some(sel => element.querySelector(sel));

                if (!isTarget && !isChildOfTarget && !isAncestorOfTarget) {
                    element.style.display = "none";
                }
            });
        }, selectors);
        /* eslint-enable */
    }

    async _hideChatElements() {
        if (this.useNewNav) return;

        /* eslint-disable */
        await this.page.evaluate(() => {
            const newMessages = document.querySelector('[class^="newMessagesBar"]');
            if (newMessages) newMessages.style.display = "none";

            const messagesWrapper = document.querySelector('[class^="messagesWrapper"]'),
                chatBox = messagesWrapper.nextElementSibling;

            if (chatBox) chatBox.style.display = "none";
        });
        /* eslint-enable */
    }

    async _hideFlashes() {
        /* eslint-disable */
        await this.page.evaluate(() => {
            const flashes = document.querySelectorAll('[class^="flash"]');

            for (const flash of flashes) {
                const message = flash.firstElementChild;

                if (message) {
                    flash.parentNode.insertBefore(message, flash.nextElementSibling);

                    flash.removeChild = () => {};
                    flash.appendChild(document.createElement("div"));
                }
            }
        });
        /* eslint-enable */
    }

    async _navigateToMessage(serverId, channelId, messageId, options = {}) {
        const scrollToTop = options.scrollToTop ?? false;

        logger.info(`Navigating to server: ${serverId}, channel: ${channelId}, message: ${messageId}`);

        const targetUrl = Util.getMessageUrl(serverId, channelId, messageId);

        /* eslint-disable */
        await this.page.evaluate(targetUrl => {
            if (window.location.pathname !== targetUrl) {
                window.history.pushState(null, "", targetUrl);
                window.history.pushState(null, "", null);

                window.history.go(-1);
            }
        }, targetUrl);
        /* eslint-enable */

        const messageSelector = Util.getMessageSelector(channelId, messageId);

        try {
            await this.page.waitForSelector(messageSelector, { timeout: 2000 });
        } catch (err) {
            if (err.name === "TimeoutError") {
                return;
            }

            throw err;
        }

        await this._hideChatElements();
        await this._hideFlashes();

        if (scrollToTop) {
            await this._instantScroll(this.page, messageSelector);
        }

        await Util.delay(this.useNewNav ? 200 : 1000);
        return await this.page.$(messageSelector);
    }

    async _getMessagesRect(element, channelId, messageIds) {
        const elements = [element];

        for (const id of messageIds.slice(1)) {
            const messageSelector = Util.getMessageSelector(channelId, id);
            elements.push(await this.page.$(messageSelector));
        }

        let boundingBoxes = await Promise.all(elements.map(element => element?.boundingBox()));
        boundingBoxes = boundingBoxes.filter(Boolean);

        if (boundingBoxes.length === 0) {
            throw new CustomError("No valid bounding boxes found for the messages");
        }

        const minX = Math.min(...boundingBoxes.map(box => box.x)),
            minY = Math.min(...boundingBoxes.map(box => box.y)),
            maxX = Math.max(...boundingBoxes.map(box => box.x + box.width)),
            maxY = Math.max(...boundingBoxes.map(box => box.y + box.height));

        const width = maxX - minX,
            height = maxY - minY;

        if (maxY > this.window.height) {
            throw new CustomError("Messages too tall, they don't fit in the browser window");
        }

        return {
            x: Math.floor(minX),
            y: Math.floor(minY),
            width: Math.floor(width),
            height: Math.floor(height)
        };
    }

    async _getProfilePictureRect(element) {
        let x = 0,
            y = 0,
            width = 0,
            height = 0;

        const pfp = await element.$(profilePictureSelector);

        if (pfp) {
            const messageBox = await element.boundingBox(),
                pfpBox = await pfp.boundingBox();

            x = pfpBox.x - messageBox.x;
            y = pfpBox.y - messageBox.y;

            ({ width, height } = pfpBox);
        }

        return {
            x: Math.floor(Util.clamp(x, -(2 ** 15), 2 ** 15)),
            y: Math.floor(Util.clamp(y, -(2 ** 15), 2 ** 15)),
            width: Math.floor(Util.clamp(width, -(2 ** 15), 2 ** 15)),
            height: Math.floor(Util.clamp(height, -(2 ** 15), 2 ** 15))
        };
    }

    async _crashed() {
        const crashPage = await this.page.$('[class*="errorPage"]');
        return crashPage ? true : false;
    }

    _setCrashCheckInterval() {
        async function reload() {
            if (await this._crashed()) {
                logger.info("Discord page crashed, reloading...");
                await this.page.reload();
            }
        }

        this._crashCheckTimer = setInterval(reload.bind(this), 5000);
    }

    _clearCrashCheckInterval() {
        if (typeof this._crashCheckTimer === "undefined") {
            return;
        }

        clearInterval(this._crashCheckTimer);
        delete this._crashCheckTimer;
    }
}

export default PuppeteerService;
