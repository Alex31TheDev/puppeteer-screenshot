import login from "./login.js";
import * as screenshotRoutes from "./screenshot.js";

export default {
    login,
    ...screenshotRoutes
};
