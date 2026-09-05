# Dependency security maintenance

The 5 September 2026 dependency review updated Next.js to 15.5.25 with matching `eslint-config-next`, Hono to 4.13.7 with its Node adapter 1.19.17, and the static marketing site to Astro 7.3.1. The shadcn CLI is a development dependency; application source does not import it.

The mobile scaffold now uses Expo SDK 57.0.20, React Native 0.86.3, React/React DOM 19.2.3, and the SDK-matched Metro runtime and status bar. Metro uses Expo's automatic monorepo configuration. No business application source changed for this upgrade. The scaffold has no checked-in iOS or Android project directories or custom native plugins.

Library and API builds use tsdown 0.23.0 instead of tsup, whose latest stable release retained a vulnerable esbuild version. The build commands explicitly retain ESM, ES2022, `.js` / `.d.ts` filenames, and the existing output directories. In particular, API startup still uses `node dist/server.js`.

## Runtime and platform requirements

The root build tooling requires **Node.js 22.18+ within Node 22, 24.11+ within Node 24, or Node 26+**, declared in the root `engines`. Verification used Node 24.19.0. The Astro site's own minimum is Node 22.12, but workspace installation and builds must satisfy the stricter root requirement.

Expo SDK 57 adopts the current React Native architecture and the SDK 56 platform baseline, including iOS 16.4+ and Xcode 26.4+. Native device compatibility must be tested before a mobile release. The production web start command launches only `@miniros/web`; the marketing site deploys its generated static files independently.

## Compatible transitive fixes

The root `pnpm.overrides` entries apply only to vulnerable version ranges. They preserve the major versions of PostCSS, Nano ID, Browserslist, fast-uri, js-yaml, brace-expansion, Undici, qs, SVGO, and YAML; xmldom 0.9 stays on 0.9. The PostCSS override replaces the old version pinned by Next.js. These are actual package replacements, not audit exclusions.

Keep `pnpm-lock.yaml` committed and use `pnpm install --frozen-lockfile`. The obsolete root npm lockfile and the site's Astro 5 npm lockfile were removed so tooling detects one package manager. Recheck overrides when updating their parent packages; remove an override once every relevant parent resolves a patched version without it.

## Audit scope and remaining alerts

Counts are registry advisory alerts, not counts of independently exploitable application vulnerabilities. The web runtime column includes paths rooted in `apps/web` dependencies or optional dependencies; development dependencies are excluded. The initial web runtime tree included the shadcn CLI.

| Scope                                         |                                       Before |      After |
| --------------------------------------------- | -------------------------------------------: | ---------: |
| Web runtime                                   |             35 (20 high, 14 moderate, 1 low) |          0 |
| All workspace production dependency trees     | 82 (1 critical, 47 high, 30 moderate, 4 low) | 1 moderate |
| Entire workspace, including development tools | 84 (1 critical, 47 high, 32 moderate, 4 low) | 2 moderate |

Two alerts remain visible, with no critical, high, or low alerts:

- `esbuild` 0.18.20 through `drizzle-kit` 0.31.10 → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils`. This is the latest stable Drizzle Kit; the next release is still a release candidate. The advisory concerns esbuild's development server. The installed loader calls `transform` / `transformSync`, not `serve`; this finding does not demonstrate an exposed production web endpoint.
- `uuid` 7.0.3 through Expo's native configuration tooling → `xcode` 3.0.1. Expo and xcode are on their latest stable releases. The advisory concerns `v3` / `v5` / `v6` calls with caller-provided buffers. The installed xcode consumer calls `uuid.v4()` without arguments. This dependency remains in the Expo dependency tree, but that call does not exercise the reported vulnerable methods.

Patched versions of the leaf packages exist; there is no stable parent-package upgrade that removes these two alerts. Neither alert was ignored, and no incompatible transitive major was forced. Recheck the parent releases before future upgrades. The old Expo tar, xmldom, and image-size dependency paths were removed by the SDK upgrade rather than overridden.

## Verification

The dependency follow-up passed:

- Frozen-lockfile installation with dependency lifecycle scripts disabled.
- Expo dependency alignment (`expo install --check`) and Expo Doctor: 21/21 checks.
- Mobile TypeScript and ESLint checks.
- Mobile web export and Android/iOS JavaScript-to-Hermes bundle exports.
- All five library bundles and declaration outputs, plus the API bundle and `node --check` on its startup artifact.

Native app compilation, installation, and device execution were not performed: this machine has command-line developer tools but no full Xcode installation. Hermes exports verify bundling, not a native app build. The final all-workspace build and application regression suite remain release checks performed after all source fixes are complete.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm audit --json
corepack pnpm audit --prod --json
corepack pnpm --filter @miniros/mobile exec expo install --check
corepack pnpm --dir apps/mobile dlx expo-doctor@1.20.4
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Audit commands intentionally return nonzero while the two alerts remain. Inspect `findings[].paths` in the JSON to distinguish web runtime, site, mobile tooling, and development tools.

Primary sources: [Next.js Server Actions advisory](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj), [PostCSS advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp), [Hono advisory](https://github.com/honojs/hono/security/advisories/GHSA-8j4g-w8fx-2239), [Astro 6 migration](https://docs.astro.build/en/guides/upgrade-to/v6/), [Astro 7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/), [Expo SDK upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [Expo SDK 57 release notes](https://expo.dev/changelog/sdk-57), [Expo SDK 56 platform changes](https://expo.dev/changelog/sdk-56), [Expo monorepo configuration](https://docs.expo.dev/guides/monorepos/), [tsup-to-tsdown migration](https://tsdown.dev/guide/migrate-from-tsup), [esbuild advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99), and [UUID advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq). Counts are a dated npm registry audit snapshot.
