---
name: tanstack-table
description: How this repo uses TanStack Table (v9) — where to find the real API reference and the project's own conventions. Load before touching any column definition, `useTable` call, or `src/components/data-table.tsx`.
---

## Read this first: the version matters

This repo runs **`@tanstack/react-table` v9**, not v8. v9 reshaped the API —
`useReactTable` became `useTable`, row models moved into `tableFeatures()`
slots, `createColumnHelper` gained a features generic, `sortingFn` became
`sortFn`. Any v8-shaped example (including ones a model may recall from
training, and including previous versions of this very skill file) will not
compile.

**Do not guess the API from memory.** Before writing or changing a column
definition or a `useTable` call, read the *installed* reference:

```
node_modules/@tanstack/table-core/skills/          — core, table-features,
                                                       sorting, pagination,
                                                       client-vs-server,
                                                       typescript, …
node_modules/@tanstack/react-table/skills/         — getting-started,
                                                       table-state,
                                                       migrate-v8-to-v9, …
```

Each is a short, version-matched skill in the same format as this one. Start
with `table-core/skills/core` and `table-core/skills/table-features`, then the
react-adapter's `getting-started`. If a method or option you expect doesn't
exist, check `table-features` first — v9 gates most APIs behind an explicit
feature registration, so a missing method usually means a missing feature, not
a typo.

## How this repo uses it

- **One shared `features` object**, in `src/components/data-table.tsx`:
  `tableFeatures({ rowSortingFeature, rowPaginationFeature, columnMeta:
  metaHelper<ColumnMeta>() })`. Every table in the app — catalog and detail —
  is built against this same object, so every column def has the same
  `typeof features` and can be passed to the shared `<DataTable>` renderer.
- **Manual mode for the five catalog tables** (`empresas`, `servicios`,
  `terminales`, `rutas` × 2 tabs). Postgres does the sorting, filtering and
  pagination; the table gets `manualSorting: true`, `manualPagination: true`,
  `rowCount: total`, and its `state.sorting` / `state.pagination` are derived
  from the route's URL search params via `src/lib/table-state.ts`'s
  `useUrlTableState`. Filtering never reaches the table at all — `FilterBar`
  writes the URL, the loader refetches, the table just receives different
  `data`/`rowCount`.
- **No row-model slots are registered** (`sortedRowModel`,
  `paginatedRowModel`) — `manualSorting`/`manualPagination` bypass them, so
  registering them would be dead code. `table.getRowModel()` always returns
  the base, unprocessed rows, which is exactly what a page already sorted and
  sliced by Postgres needs.
- **The eleven detail-page tables and the two dashboard tables** have no
  sorting, filtering or pagination and must keep having none: they call
  `useTable({ features, columns, data, getRowId, enableSorting: false })` and
  nothing else. `enableSorting: false` is load-bearing — it is a table-level
  option that suppresses the sort affordance for every column at once, so a
  detail table doesn't grow clickable headers just because it shares the
  `features` object with the catalogs.
- **Strict parity is the standard.** No column visibility, resizing, pinning,
  selection, expanding, grouping or virtualization anywhere in this repo.
  Don't add any of it without being asked.
- **`enableSortingRemoval: false`, `enableMultiSort: false`,
  `sortDescFirst: false`** are set on every catalog table's `useTable` call.
  The first two keep the sort cycle at asc ⇄ desc, matching the URL's single
  `sort`/`dir` pair. The third is not cosmetic: without it, v9's
  `getFirstSortDir` falls through to `getAutoSortDir`, which calls
  `table.getFilteredRowModel()` — a method that belongs to
  `columnFilteringFeature`, which this app never registers. The first header
  click would throw.
- **`row.getAllCells()`, not `row.getVisibleCells()`**, in
  `src/components/data-table.tsx`'s `<DataTable>` — the latter belongs to
  `columnVisibilityFeature`, which is not registered.
- **A column can only sort if it has an `accessorFn`.** `helper.display({...})`
  columns never show a sort affordance — used deliberately for the `Estatus`
  column where its underlying field isn't in the entity's sort-key union.
  Where a sortable column's *display* differs from its *sort key* (`rutas`'
  `status`/`sale`/`main` columns render stamps but sort on booleans), it's
  still `helper.accessor(...)` with an explicit `id` override, never
  `helper.display(...)`.
- **Column `id` equals the server's sort key.** `helper.accessor('key', …)`
  on `CompanyRow` gives `id: 'key'`, which is already the string
  `buildOrderBy` in `src/server/companies.ts` switches on. This is what
  collapses the old three-way duplication (`*_SORTS` const, `oneOf()` guard,
  `buildOrderBy` map) into one thing.
- **`ManifestSkeleton`'s widths come from the columns.** Each column's
  `meta.skeletonWidth` feeds `skeletonWidths(columns)` in
  `src/components/data-table.tsx`, used in every route's `pendingComponent`.
  Don't hand-write a skeleton width array — add `skeletonWidth` to the column
  instead.

## Where things live

| What | Where |
| --- | --- |
| Shared `features`, `ColumnMeta`, `<DataTable>`, `skeletonWidths` | `src/components/data-table.tsx` |
| URL ↔ table-state bridge (`useUrlTableState`) | `src/lib/table-state.ts` |
| Presentational primitives (`Th`, `Td`, `TableRow`, `RowLink`, `Pagination`) | `src/components/table.tsx` |
| Per-catalog column definitions | `src/routes/<catálogo>/columns.tsx` |
| Detail-page and dashboard column definitions | inline, module scope, in the route file that owns them |
