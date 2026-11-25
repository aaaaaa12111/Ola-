"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSpawnOptions = buildSpawnOptions;
const node_path_1 = __importDefault(require("node:path"));
const command_builder_1 = require("./command-builder");
function pickContainerEnv(baseEnv, token) {
    const allow = new Set(['PHP_WORKBENCH_DEBUG', 'PHP_WORKBENCH_LOG', 'PHP_WORKBENCH_TIMEOUT']);
    const out = {};
    for (const [k, v] of Object.entries(baseEnv || {})) {
        if (!allow.has(k))
            continue;
        if (typeof v === 'string')
            out[k] = v;
    }
    if (token)
        out['PHP_WORKBENCH_TOKEN'] = token;
    return out;
}
/**
 * Build spawn options for the selected runtime.
 *
 * Why: Keep process creation decoupled from VS Code APIs and side effects.
 * What: For now, only local is implemented; others will be added incrementally.
 */
function buildSpawnOptions(input) {
    if (input.selected === 'docker') {
        const workspaceRoot = input.workspaceRoot ?? input.cwd;
        const extensionRoot = input.extensionRoot ?? node_path_1.default.dirname(input.entrypoint);
        const containerWorkspace = '/workspace';
        const containerExt = '/ext';
        const entryRel = node_path_1.default.relative(extensionRoot, input.entrypoint);
        const entryInContainer = node_path_1.default.posix.join(containerExt, entryRel.split(node_path_1.default.sep).join('/'));
        const normalizedEnv = pickContainerEnv(input.baseEnv, input.token);
        const docker = (0, command_builder_1.buildDockerRunCommand)({
            image: input.dockerImage || 'php:cli',
            workdir: containerWorkspace,
            mounts: [
                { source: workspaceRoot, target: containerWorkspace },
                { source: extensionRoot, target: containerExt, options: 'ro' },
            ],
            env: normalizedEnv,
            phpArgs: ['-ddisplay_errors=1', '-derror_reporting=E_ALL'],
            entrypointPathInContainer: entryInContainer,
        });
        return {
            command: docker.command,
            args: docker.args,
            cwd: process.cwd(),
            env: { ...process.env },
        };
    }
    if (input.selected === 'compose') {
        const normalizedEnv = pickContainerEnv(input.baseEnv, input.token);
        const compose = (0, command_builder_1.buildComposeExecCommand)({
            service: input.composeService || 'app',
            workdir: '/workspace',
            env: normalizedEnv,
            entrypointPathInService: input.entrypoint,
        });
        return {
            command: compose.command,
            args: compose.args,
            cwd: process.cwd(),
            env: { ...process.env },
        };
    }
    // compose wiring to be added later; fall through to local
    return {
        command: 'php',
        args: [input.entrypoint],
        cwd: input.cwd,
        env: { ...input.baseEnv, PHP_WORKBENCH_TOKEN: input.token ?? '' },
    };
}
//# sourceMappingURL=session-factory.js.map