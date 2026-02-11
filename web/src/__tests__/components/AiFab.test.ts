import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AiFab from "../../components/AiFab.vue";

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("AiFab", () => {
  it("renders a button with aria-label", () => {
    const wrapper = mount(AiFab);
    const button = wrapper.find("button");
    expect(button.exists()).toBe(true);
    expect(button.attributes("aria-label")).toBe("Open AI Assistant");
  });

  it("navigates to /ai on click", async () => {
    const wrapper = mount(AiFab);
    await wrapper.find("button").trigger("click");
    expect(mockPush).toHaveBeenCalledWith("/ai");
  });

  it("has the sparkle SVG icon", () => {
    const wrapper = mount(AiFab);
    expect(wrapper.find("svg").exists()).toBe(true);
  });
});
