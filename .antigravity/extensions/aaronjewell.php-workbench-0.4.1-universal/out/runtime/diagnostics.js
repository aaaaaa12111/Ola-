"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRuntimeDiagnostics = computeRuntimeDiagnostics;
const selection_1 = require("./selection");
function computeRuntimeDiagnostics(input) {
    const selected = (0, selection_1.selectRuntimeMode)({
        mode: input.mode,
        remoteName: input.remoteName,
        hasComposeService: !!input.composeService,
        hasDockerImage: !!input.dockerImage,
    });
    const errors = [];
    const warnings = [];
    const suggestions = [];
    if (!input.entrypoint.match(/\.phar$/)?.length) {
        warnings.push('Packaged PHAR not found');
        suggestions.push('Use the published extension or install from .vsix');
    }
    if (selected === 'local' && !input.phpOnPath) {
        errors.push('Local PHP binary not found on PATH.');
        suggestions.push('Install PHP CLI or switch to docker/compose runtime.');
    }
    if (selected === 'docker' && !input.dockerImage) {
        errors.push('Docker runtime selected but no image configured.');
        suggestions.push('Set phpWorkbench.runtime.image or switch to auto/local.');
    }
    if (selected === 'compose' && !input.composeService) {
        errors.push('Compose runtime selected but no service configured.');
        suggestions.push('Set phpWorkbench.runtime.composeService or switch to auto/local.');
    }
    return { selected, errors, warnings, suggestions };
}
//# sourceMappingURL=diagnostics.js.map