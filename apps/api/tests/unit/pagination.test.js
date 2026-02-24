import { describe, expect, it } from "vitest";
import { paginationMeta, parsePagination } from "../../src/utils/pagination.js";

describe("pagination utils", () => {
  it("parses defaults", () => {
    const p = parsePagination({}, { defaultPage: 1, defaultPageSize: 20, maxPageSize: 100 });
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(20);
    expect(p.skip).toBe(0);
    expect(p.take).toBe(20);
  });

  it("caps page size", () => {
    const p = parsePagination({ page: "2", pageSize: "999" }, { defaultPage: 1, defaultPageSize: 20, maxPageSize: 50 });
    expect(p.page).toBe(2);
    expect(p.pageSize).toBe(50);
    expect(p.skip).toBe(50);
    expect(p.take).toBe(50);
  });

  it("builds pagination meta", () => {
    const m = paginationMeta(101, 2, 20);
    expect(m.total).toBe(101);
    expect(m.page).toBe(2);
    expect(m.pageSize).toBe(20);
    expect(m.totalPages).toBe(6);
  });
});
