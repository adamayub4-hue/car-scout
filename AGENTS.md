<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Keep owner and agent testing out of website analytics

Use local/preview environments for testing. Before any production browser QA, open `https://mekivo.uk/traffic-settings?analytics=off` in that browser and confirm “This browser is excluded from visitor reports.” Do this again for every new browser/profile/private window. Use direct site links, not live paid adverts, when testing. Do not generate production campaign or funnel events as a way of checking reporting; test the policy and event payloads locally. Historical reports already contain earlier QA traffic and must not be described as purely customer results.
