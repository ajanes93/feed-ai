import { createRouter, createWebHistory } from "vue-router";
import FeedView from "./views/FeedView.vue";
import DashboardView from "./views/DashboardView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: FeedView },
    { path: "/dashboard", component: DashboardView },
  ],
});

export default router;
