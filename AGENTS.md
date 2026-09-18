# Repository Guidelines

## Project Structure & Module Organization

GitMD is a pnpm workspace monorepo. The desktop client is in `apps/desktop`: React/TypeScript UI lives in `src/`, while the Tauri/Rust host and Git engine live in `src-tauri/`. The static documentation and marketing site is in `apps/website`. Shared framework-free logic belongs in `packages/core/src/`; reusable UI primitives and design tokens belong in `packages/design-system/src/`. Vitest unit tests are under `tests/unit/`, Playwright flows under `tests/e2e/`, and Rust integration tests are in `apps/desktop/src-tauri/tests/`. Product and architecture documentation is in `docs/`.

## Build, Test, and Development Commands

Use Node 20+ and the pinned pnpm version (`corepack enable`). Common commands:

```bash
pnpm install                 # install workspace dependencies
pnpm start                   # shortcut for the full desktop app
pnpm tauri:dev               # run the desktop app with hot reload
pnpm dev                     # run the browser demo mode
pnpm typecheck               # type-check all packages
pnpm test                    # run Vitest unit tests
pnpm test:e2e                # run Playwright demo-mode tests
pnpm build                   # build every workspace package
pnpm lint                    # run workspace linters
```

For engine changes, run `cd apps/desktop/src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`. Run `pnpm icons` once before the first Tauri build if generated icons are missing.

## Coding Style & Naming Conventions

Follow strict TypeScript: avoid `any`, use `unknown` with narrowing, and do not add explanatory inline comments. Use `@/` imports inside the desktop app and package-name imports across workspaces; avoid deep relative imports. Components and matching files use `PascalCase`, functions and values use `camelCase`, and constants use `SCREAMING_SNAKE_CASE`. Keep domain logic in `packages/core` and Tauri commands thin. Rust must pass `rustfmt` and `clippy -D warnings`; do not use `unwrap()` outside tests. Use Tailwind utilities and design-system tokens, with the project’s 8px spacing scale and no component hex colors.

## Testing Guidelines

Name unit files `*.test.ts` and place them in `tests/unit/`. Add behavior tests with the relevant change: core logic in Vitest, UI flows in Playwright, and Rust engine behavior in `src-tauri/tests/git_engine.rs`. Playwright runs against deterministic browser demo mode. No separate coverage threshold is configured, but new behavior should include regression coverage.

## Commit & Pull Request Guidelines

Use Conventional Commits, for example `feat(graph): add stash rows`, `fix(engine): handle conflicts`, or `docs: clarify setup`. Keep each PR focused, explain the user-facing “why,” link the related issue when applicable, and include screenshots or a screencast for UI changes. Before requesting review, run the relevant checks above and note any platform-specific limitations.

## Security & Configuration

Never commit repository contents, credentials, AI keys, or signing material. Follow `SECURITY.md` for vulnerability reports and keep local secrets in the documented environment/configuration locations.
