## Testing plan (stable, low‑churn safety nets)

- Runtime selection
  - Cases: auto, explicit, Dev Container detected, compose present, fallback to local.

- PHAR entrypoint selection
  - `getPhpEntrypoint` prefers `out/php-workbench.phar` when present; else `bin/workbench`.

- Path mapping utilities
  - Host↔container mapping across macOS/Linux/Windows/WSL2; round‑trip properties.

- Command assembly (no spawn)
  - Golden argv for docker (user/default image) and compose exec; flags: `--user`, mounts, workdir, env.

- Dev Container detection
  - Pure detection based on env/FS markers.

- JSON‑RPC invariants (backend‑agnostic)
  - Using a fake session/duplex streams: request/response, token, timeouts, cleanup on close.

### Start now

1. Export `getPhpEntrypoint` and add unit tests for PHAR selection (present/absent).
2. Extract and test Dev Container detection.
3. Introduce path mapping module with unit/property tests.
4. Add command builder module with golden tests.
5. Add JSON‑RPC contract tests with a fake backend.

### Principles for low‑churn, high‑safety coverage

- Focus on stable contracts (pure functions and selection logic), not concrete backend implementations.
- Define invariants once and test them via contract tests that every backend must satisfy.
- Prefer pure, isolated modules with golden/property tests over integration that depends on specific CLIs.

### What to test first (stable and unlikely to change)

- Runtime selection (pure)
  - Given settings and env, which backend is chosen?
  - Cases: auto vs explicit; Dev Container detected; compose settings present; fallback to local.
- PHAR selection (pure)
  - `getPhpEntrypoint()` prefers `.phar` if present, else `bin/workbench`.
- Path mapping (pure)
  - Host↔container workspace path translation across macOS/Linux/WSL2/Windows; preserved relative paths; error cases.
  - Property checks: mapping + inverse mapping round‑trips; preserves basename.
- Command assembly (pure)
  - Build-only functions that output argv for docker/compose/local without spawning.
  - Golden tests for: user image, default image, compose exec, `--user`, extra mounts, workdir, env passthrough.
- Dev Container detection (pure)
  - Detect based on known env/FS markers; unit tests over inputs.
- JSON‑RPC invariants (backend‑agnostic)
  - Contract tests using a fake in‑process “runner” (Node streams) to validate:
    - Send/receive `eval` requests, token pass‑through, error mapping, connection close/cleanup, timeouts trigger error.

These tests won’t churn as we add Docker/Compose backends because they assert contracts and inputs/outputs, not the mechanics.

### Later (still stable, but after foundation)

- Diagnostics contract
  - “Validate runtime” returns a structured result with typed statuses and remediation hints.
- Session semantics
  - Invariants already covered: state persists across eval; restart resets state.

### How to put this in place first (sequence)

1. Extract pure modules
   - `runtime/selection.ts` (decides backend), `runtime/pathMapping.ts`, `runtime/commandBuilder.ts`, `env/devContainer.ts`, and keep `getPhpEntrypoint` exported.
2. Write tests first for the pure modules
   - `selection.test.ts`, `pathMapping.test.ts` (include property tests), `commandBuilder.test.ts`, `devContainer.test.ts`, `entrypoint.test.ts`.
3. Add JSON‑RPC contract tests with a fake backend
   - A `FakeSession` that provides duplex streams; a tiny “fake runner” echoes requests and simulates errors/timeouts. Assert RpcServer behavior.
4. Introduce a `RuntimeBackend` interface and shared contract tests
   - A single suite that runs against any backend adapter (later: Local, Docker, Compose) using the fake process layer; keeps behavior consistent without binding to CLI specifics.
5. Keep existing end‑to‑end tests
   - They guard command wiring and UX; minimize changes there.

### Example test targets (acceptance in one liners)

- selection: auto + devcontainer → LocalPhpBackend; compose settings present → ComposeBackend.
- entrypoint: phar exists → returns phar; otherwise `bin/workbench`.
- pathMapping: `C:\repo\sub` → `/mnt/c/repo/sub`; inverse returns original.
- commandBuilder: “docker user image + mounts + workdir” yields exact argv.
- devContainer: VS Code’s known env marks → true; otherwise false.
- rpc contract: invalid token → error; connection close → dispose triggered; long output streaming works.

### Tooling notes

- Use dependency injection to avoid process spawn in tests.
- Keep tests deterministic; no network, no docker required.
- If adding property tests, keep bounds modest to avoid flakiness.

This gives strong safety nets around the core contracts with minimal churn as we implement new backends.
