export function parsePagination(query, defaults = {}) {
  const defaultPage = Number.isFinite(defaults.defaultPage) ? defaults.defaultPage : 1;
  const defaultPageSize = Number.isFinite(defaults.defaultPageSize) ? defaults.defaultPageSize : 20;
  const maxPageSize = Number.isFinite(defaults.maxPageSize) ? defaults.maxPageSize : 100;

  const pageRaw = Number(query?.page);
  const pageSizeRaw = Number(query?.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : defaultPage;
  const pageSizeUncapped = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : defaultPageSize;
  const pageSize = Math.min(pageSizeUncapped, maxPageSize);
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  return { page, pageSize, skip, take };
}

export function paginationMeta(total, page, pageSize) {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  return { total: safeTotal, page, pageSize, totalPages };
}
