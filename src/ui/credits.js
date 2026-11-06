export function filterCredits(rows, query = '') {
  const needle = query.trim().toLocaleLowerCase();
  return needle
    ? rows.filter((row) =>
        [row.character, row.jyutping, row.gloss, row.author, row.license].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase()
            .includes(needle),
        ),
      )
    : rows;
}
export function creditsPage(rows, index = 0) {
  const pages = Math.max(1, Math.ceil(rows.length / 20)),
    page = Math.max(0, Math.min(pages - 1, Number.isFinite(index) ? Math.floor(index) : 0));
  return { page, pages, rows: rows.slice(page * 20, page * 20 + 20) };
}
