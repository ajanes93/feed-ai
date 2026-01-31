import type { DOMWrapper } from "@vue/test-utils";

declare module "@vue/test-utils" {
  interface VueWrapper {
    findByTestId(testId: string): DOMWrapper<Element>;
    findAllByTestId(testId: string): DOMWrapper<Element>[];
    findByAria(label: string): DOMWrapper<Element>;
    findAllByAria(label: string): DOMWrapper<Element>[];
  }
}
