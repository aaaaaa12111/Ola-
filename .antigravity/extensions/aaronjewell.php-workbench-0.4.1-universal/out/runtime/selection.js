"use strict";
/**
 * Decide which runtime backend to use based on user settings and environment.
 *
 * Why: Keep the decision deterministic and testable without touching VS Code
 * APIs directly. This enables low‑churn tests while we add new backends.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectRuntimeMode = selectRuntimeMode;
const CONTAINERIZED_REMOTES = new Set(['dev-container', 'codespaces']);
/**
 * What: Returns a concrete runtime backend to use.
 */
function selectRuntimeMode(input) {
    const { mode, remoteName, hasComposeService, hasDockerImage } = input;
    if (mode === 'local')
        return 'local';
    if (mode === 'docker')
        return 'docker';
    if (mode === 'compose')
        return 'compose';
    // auto
    const rn = (remoteName || '').toLowerCase();
    if (CONTAINERIZED_REMOTES.has(rn)) {
        return 'local';
    }
    if (hasComposeService)
        return 'compose';
    if (hasDockerImage)
        return 'docker';
    return 'local';
}
//# sourceMappingURL=selection.js.map