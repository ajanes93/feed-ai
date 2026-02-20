import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./style.css";

router.isReady().then(() => createApp(App).use(router).mount("#app"));
