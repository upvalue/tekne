/**
 * Dependency layering for the packages (top-level directories) in src/.
 *
 * A package may only import from packages EARLIER in LAYER_ORDER. Root-level
 * files (main.tsx, routeTree.gen.ts) sit above every package. Run with
 * `pnpm depcruise` (also part of `pnpm check`).
 */
const LAYER_ORDER = [
  // Foundation: stylesheets and generic utilities with no knowledge of the app.
  'styles',
  'lib',

  // Domain: the document model — schema, markdown parser, and pure analysis
  // code (table of contents, tag renames, validation, the tutorial doc).
  'docs',

  // Data: database setup, migrations, and row types; the search query parser.
  'db',
  'search',

  // API: tRPC routers (server side), derived-row logic, and the client.
  'trpc',

  // Backend entry point: the express server. Nothing may import it (see the
  // no-import-of-entry-points rule below).
  'server',

  // UI foundation: generic components, static documentation pages, and
  // shared hooks/atoms (including cross-feature state like panel visibility).
  'components',
  'documentation',
  'hooks',

  // Features: the editor is the core feature; dev tools, the side panel, the
  // command definitions, and standalone controls build on top of it.
  'editor',
  'dev',
  'panel',
  'commands',
  'controls',

  // App shell: layouts and the route tree.
  'layout',
  'routes',
]

/** Entry points may be imported by build tooling only, never from src/. */
const ENTRY_ONLY = ['server']

const upwardRules = LAYER_ORDER.slice(0, -1).map((pkg, i) => ({
  name: `no-upward-from-${pkg}`,
  comment: `src/${pkg} may only import from: ${LAYER_ORDER.slice(0, i).join(', ') || '(nothing)'}`,
  severity: 'error',
  from: { path: `^src/${pkg}/` },
  to: { path: `^src/(${LAYER_ORDER.slice(i + 1).join('|')})/` },
}))

module.exports = {
  forbidden: [
    ...upwardRules,
    {
      name: 'no-import-of-entry-points',
      comment: 'entry point packages must not be imported from src/',
      severity: 'error',
      from: { path: '^src/', pathNot: `^src/(${ENTRY_ONLY.join('|')})/` },
      to: { path: `^src/(${ENTRY_ONLY.join('|')})/` },
    },
    {
      name: 'no-undeclared-package',
      comment:
        'new top-level src/ directories must be added to LAYER_ORDER in .dependency-cruiser.cjs',
      severity: 'error',
      from: { path: `^src/(?!(${LAYER_ORDER.join('|')})/)[^/]+/` },
      to: {},
    },
    {
      name: 'no-circular',
      comment: 'no file-level dependency cycles',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}
