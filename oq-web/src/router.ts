import type { RouteRecordRaw } from "vue-router";
import OneQuestionView from "./views/OneQuestionView.vue";
import DashboardView from "./views/DashboardView.vue";
import OQMethodologyView from "./views/OQMethodologyView.vue";
import OQScoreDetailView from "./views/OQScoreDetailView.vue";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: OneQuestionView,
  },
  {
    path: "/score/:date",
    name: "score-detail",
    component: OQScoreDetailView,
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
];
