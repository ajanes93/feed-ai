import { createRouter, createWebHistory } from "vue-router";
import OneQuestionView from "./views/OneQuestionView.vue";
import DashboardView from "./views/DashboardView.vue";
import OQMethodologyView from "./views/OQMethodologyView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: OneQuestionView,
    },
    {
      path: "/methodology",
      name: "methodology",
      component: OQMethodologyView,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
    },
  ],
});

export default router;
