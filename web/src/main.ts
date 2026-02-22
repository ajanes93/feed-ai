import { ViteSSG } from "vite-ssg";
import { autoAnimatePlugin } from "@formkit/auto-animate/vue";
import App from "./App.vue";
import { routes } from "./router";
import "./style.css";

export const createApp = ViteSSG(App, { routes }, ({ app }) => {
  app.use(autoAnimatePlugin);
});
