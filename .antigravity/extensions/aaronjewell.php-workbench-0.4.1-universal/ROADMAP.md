## Project plan: runtime backends and sandboxing

### Scope and priorities

- **Priority order**: Dev Container detection → Docker (user image) → Docker (default image) → Docker Compose exec → Local PHP fallback.
- **Cross-cutting**: path mapping, session lifecycle, diagnostics, docs, tests.

### Step 1 — Foundation: runtime abstraction

- **Deliverables**:
  - `RuntimeBackend` interface (start, stop, stdin/stdout streams, cwd mapping).
  - `SessionFactory` chooses backend from settings/environment.
  - Unit tests for selection logic and API contract.
  - Docs for configuration keys.
- **Acceptance**:
  - Local process path remains default and tests green.

### Step 2 — Dev Container detection (zero‑config)

- **Deliverables**:
  - Detect VS Code Dev Containers/Codespaces; if detected and mode=auto → use `LocalPhpBackend`.
  - Tests for detection logic.
  - Docs: behavior when inside Dev Containers.
- **Acceptance**:
  - Inside a Dev Container, runner uses container’s `php` with current UX.

### Step 3 — PHAR packaging as default artifact

- **Deliverables**:
  - Build `php-workbench.phar` during prepublish; bundle `psysh`.
  - Extension prefers `.phar` when present (fallback: `bin/workbench`).
  - Smoke test for `.phar` stdio JSON-RPC.
  - Docs: containers use `.phar`.
- **Acceptance**:
  - No runtime dependency on `vendor/` for runner.

### Step 4 — Docker backend (user‑provided image), long‑lived session

- **Deliverables**:
  - `DockerBackend` using `docker run -i --rm` with:
    - Workspace bind mount to `runtime.workspaceMountPath` (default `/workspace`).
    - `.phar` mounted read‑only (or baked into image).
    - `--workdir` set to workspace mount path.
    - Optional `--user` and extra mounts.
  - Path mapping utility (host ↔ container) with presets and overrides.
  - Tests: command assembly, mapping, lifecycle, error taxonomy.
  - Docs: settings and examples.
- **Acceptance**:
  - Executes code in a long‑lived container with custom image; state persists across evals.

### Step 5 — Path mapping hardening (Windows/macOS/WSL2)

- **Deliverables**:
  - OS‑aware mapping (e.g., `C:\…` ↔ `/mnt/c/...`) and WSL2/Colima detection.
  - Tests for major path cases.
  - Diagnostics command prints effective mapping.
- **Acceptance**:
  - Robust path translation across platforms.

### Step 6 — Docker backend (default image fallback)

- **Deliverables**:
  - Default image (e.g., `php:8.3-cli`), configurable tag.
  - Preflight: `php -v` and `php -m` inside container.
  - Tests: fallback selection, preflight, blocked‑pull handling.
  - Docs: override image; offline policy (`allowImagePull`).
- **Acceptance**:
  - Works out‑of‑the‑box with a standard PHP image.

### Step 7 — Docker Compose service exec

- **Deliverables**:
  - `ComposeBackend` executing `docker compose exec -T <service> php /path/to/workbench.phar`.
  - Config: `composeProjectDir`, `files`, `service`, optional `--user`, extra args.
  - Strategy to make `.phar` available:
    - A) mount host extension dir into service, or
    - B) copy `.phar` into workspace temp path and use existing mount.
  - Tests: command assembly, service detection, attach, timeouts.
  - Docs: assumptions about workspace mounts.
- **Acceptance**:
  - Executes via existing service where workspace is already mounted.

### Step 8 — Local PHP fallback and explicit mode switching

- **Deliverables**:
  - `runtime.mode`: `auto | local | docker | compose`.
  - Command palette to switch mode; self‑test validation.
  - Tests: mode switching and persistence.
  - Docs: when to use each mode.
- **Acceptance**:
  - Users can explicitly choose local PHP; self‑test confirms readiness.

### Step 9 — Diagnostics and UX polish

- **Deliverables**:
  - “Validate runtime” command: engine availability, image/service checks, mounts, php preflight, path mapping.
  - Actionable error messages; log invoked container/compose commands.
  - Tests for diagnostics output (mocked).
- **Acceptance**:
  - Clear guidance for misconfiguration and quick recovery.

### Step 10 — Optional: additional runtimes

- **Deliverables**:
  - Configurable binary path enabling Podman/nerdctl via `DockerBackend`.
  - Experimental Linux sandbox backend (e.g., `nsjail`) behind a feature flag.
  - Tests/Docs for each.
- **Acceptance**:
  - Users can choose alternative OCI CLIs; Linux sandbox available experimentally.

### Step 11 — Defense‑in‑depth (opt‑in)

- **Deliverables**:
  - Optional PHP ini flags via `-d`: `open_basedir`, `disable_functions`, memory/time limits.
  - Tests ensuring flags apply and are overridable.
  - Docs with caveats.
- **Acceptance**:
  - Added guardrails without breaking common workflows.

### Step 12 — Composer cache and performance

- **Deliverables**:
  - Optional mounts for Composer cache (e.g., `~/.composer`).
  - Pre‑pull/pre‑start command to reduce cold start.
  - Tests for argument assembly; docs for cache benefits.
- **Acceptance**:
  - Faster container workflows when installing deps inside containers.

### Step 13 — Multi‑root and session management

- **Deliverables**:
  - Per‑root sessions; picker when multiple workspace roots.
  - Auto‑restart policy and cleanup on deactivation.
  - Tests for lifecycle across roots.
- **Acceptance**:
  - Smooth UX for multi‑root and resilient sessions.
