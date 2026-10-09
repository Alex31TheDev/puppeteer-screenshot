class DefaultBrowserConfig {
    static args = [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
    ];

    static window = {
        fullscreen: false,
        width: 1920,
        height: 1080,
        zoom: 1
    };
}

export default DefaultBrowserConfig;
