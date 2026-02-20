import { createApp } from "vue";
import { autoAnimatePlugin } from "@formkit/auto-animate/vue";
import App from "./App.vue";
import router from "./router";
import "./style.css";

const app = createApp(App).use(router).use(autoAnimatePlugin);
router.isReady().then(() => app.mount("#app"));
