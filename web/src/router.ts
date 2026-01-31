import { createRouter, createWebHistory } from "vue-router";
import FeedView from "./views/FeedView.vue";
import DashboardView from "./views/DashboardView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "today",
      component: FeedView,
    },
    {
      path: "/digest/:date",
      name: "digest",
      component: FeedView,
      props: true,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
    },
  ],
});

export default router;
