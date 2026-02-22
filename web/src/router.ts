import type { RouteRecordRaw } from "vue-router";
import FeedView from "./views/FeedView.vue";
import DashboardView from "./views/DashboardView.vue";
import AiAssistantView from "./views/AiAssistantView.vue";

export const routes: RouteRecordRaw[] = [
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
    path: "/ai",
    name: "ai",
    component: AiAssistantView,
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: DashboardView,
  },
];
