#!/usr/bin/env bash
# Run from a clean checkout of verify/pr3-34-36-38-40-20261024.
set -euo pipefail
export GEMINI_API_KEY='' NVIDIA_API_KEY='' LLM_PROVIDERS_JSON='[]'
test "$(node --version)" = 'v24.19.0'
test "$(bun --version)" = '1.4.4'
bun install --frozen-lockfile
npm run check:runtime
npm test
npm run lint
npm run build
npm run smoke:production
bun audit --production --json
git diff --exit-code -- bun.lock package.json
git diff --check
# Optional browser checks require playwright-core@1.64.1 outside this repository
# and Chromium 154.0.8037.57 at /usr/bin/chromium.
if [[ -n "${PLAYWRIGHT_CORE_PATH:-}" ]]; then
  for fixture in privacy capability-claims model-selector chat-decision intent-confirmation temporal vaos-poll; do
    node "tests/${fixture}-browser.mjs"
  done
fi
