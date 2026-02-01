import type { ComponentMountingOptions } from "@vue/test-utils";

export type RenderOptions<T> = {
  [K in keyof ComponentMountingOptions<T>]: K extends "props"
    ? Partial<ComponentMountingOptions<T>["props"]>
    : ComponentMountingOptions<T>[K];
};
