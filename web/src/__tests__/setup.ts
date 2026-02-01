import { config, VueWrapper } from "@vue/test-utils";

// Stub motion-v components as pass-through wrappers
const createMotionStub = (tag: string) => ({
  template: `<${tag} v-bind="$attrs"><slot /></${tag}>`,
  inheritAttrs: false,
});

config.global.stubs = {
  "motion.div": createMotionStub("div"),
  "motion.span": createMotionStub("span"),
  "motion.p": createMotionStub("p"),
  "motion.button": createMotionStub("button"),
  "motion.article": createMotionStub("article"),
  "motion.section": createMotionStub("section"),
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

// Stub pointer capture APIs missing from happy-dom
if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
}

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
