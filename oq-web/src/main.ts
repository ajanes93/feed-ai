import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { createHead } from "@unhead/vue/client";
import { autoAnimatePlugin } from "@formkit/auto-animate/vue";
import App from "./App.vue";
import { routes } from "./router";
import "./style.css";

const router = createRouter({ history: createWebHistory(), routes });
const head = createHead();

const app = createApp(App);
app.use(router);
app.use(head);
app.use(autoAnimatePlugin);
app.mount("#app");
