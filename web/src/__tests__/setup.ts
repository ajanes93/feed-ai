import { config, VueWrapper } from "@vue/test-utils";

// Stub motion-v components as pass-through wrappers
const motionStub = {
  template: '<div v-bind="$attrs"><slot /></div>',
  inheritAttrs: false,
};

const motionButtonStub = {
  template: '<button v-bind="$attrs"><slot /></button>',
  inheritAttrs: false,
};

const motionArticleStub = {
  template: '<article v-bind="$attrs"><slot /></article>',
  inheritAttrs: false,
};

config.global.stubs = {
  "motion.div": motionStub,
  "motion.span": motionStub,
  "motion.p": motionStub,
  "motion.button": motionButtonStub,
  "motion.article": motionArticleStub,
  "motion.section": motionStub,
  AnimatePresence: { template: "<span><slot /></span>" },
  Teleport: { template: "<span><slot /></span>" },
  "router-link": {
    template: '<a :href="to"><slot /></a>',
    props: ["to"],
  },
};

config.global.directives = {
  "auto-animate": {},
};

// Extend VueWrapper prototype with test-id helpers
VueWrapper.prototype.findByTestId = function (testId: string) {
  return this.find(`[data-testid="${testId}"]`);
};

VueWrapper.prototype.findAllByTestId = function (testId: string) {
  return this.findAll(`[data-testid="${testId}"]`);
};

VueWrapper.prototype.findByAria = function (label: string) {
  return this.find(`[aria-label="${label}"]`);
};

VueWrapper.prototype.findAllByAria = function (label: string) {
  return this.findAll(`[aria-label="${label}"]`);
};
