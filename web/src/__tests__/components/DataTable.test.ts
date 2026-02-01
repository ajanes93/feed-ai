import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DataTable from "../../components/DataTable.vue";
import type { RenderOptions } from "../utils";

const TEST_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "value", label: "Value" },
];

const TEST_PROPS = {
  columns: TEST_COLUMNS,
  rowCount: 1,
};

const render = (options: RenderOptions<typeof DataTable> = {}) => {
  const wrapper = mount(DataTable, {
    ...options,
    props: { ...TEST_PROPS, ...options.props },
  });

  return {
    wrapper,
    getHeaders: () => wrapper.findAll("th"),
    getRows: () => wrapper.findAll("tbody tr"),
  };
};

describe("DataTable", () => {
  describe("rendering", () => {
    it("renders column headers", () => {
      const { getHeaders } = render();
      const labels = getHeaders().map((h) => h.text());
      expect(labels).toEqual(["Name", "Value"]);
    });

    it("renders slot content when rowCount > 0", () => {
      const { getRows } = render({
        props: { rowCount: 1 },
        slots: {
          default: "<tr><td>Alice</td><td>42</td></tr>",
        },
      });
      expect(getRows()[0].text()).toContain("Alice");
    });
  });

  describe("empty state", () => {
    it("shows default empty message when rowCount is 0", () => {
      const { wrapper } = render({ props: { rowCount: 0 } });
      expect(wrapper.text()).toContain("No data");
    });

    it("shows custom empty message", () => {
      const { wrapper } = render({
        props: { rowCount: 0, emptyMessage: "Nothing here" },
      });
      expect(wrapper.text()).toContain("Nothing here");
    });

    it("spans all columns for empty message", () => {
      const { wrapper } = render({ props: { rowCount: 0 } });
      const td = wrapper.find("tbody td");
      expect(td.attributes("colspan")).toBe("2");
    });
  });

  describe("with different columns", () => {
    it("renders three columns", () => {
      const columns = [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "c", label: "C" },
      ];
      const { getHeaders } = render({ props: { columns, rowCount: 0 } });
      expect(getHeaders()).toHaveLength(3);
    });
  });
});
