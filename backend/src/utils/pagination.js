export function getPagination(query, defaults = { page: 1, limit: 20 }) {
  const page = Math.max(parseInt(query.page ?? defaults.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit ?? defaults.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
