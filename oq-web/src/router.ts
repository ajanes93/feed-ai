import { createRouter, createWebHistory } from "vue-router";
import OneQuestionView from "./views/OneQuestionView.vue";
import DashboardView from "./views/DashboardView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: OneQuestionView,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
    },
  ],
});

export default router;
