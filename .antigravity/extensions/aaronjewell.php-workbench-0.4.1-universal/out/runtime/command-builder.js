"use strict";
/**
 * Build-only command constructors for different backends.
 *
 * Keep process orchestration testable and stable by generating argv arrays
 * without spawning. Integration points can consume these results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLocalPhpCommand = buildLocalPhpCommand;
exports.buildDockerRunCommand = buildDockerRunCommand;
exports.buildComposeExecCommand = buildComposeExecCommand;
function buildLocalPhpCommand(opts) {
    return { command: 'php', args: [opts.entrypoint] };
}
function buildDockerRunCommand(opts) {
    const args = ['run', '-i', '--rm'];
    if (opts.user) {
        args.push('-u', opts.user);
    }
    for (const m of opts.mounts) {
        const spec = `${m.source}:${m.target}${m.options ? ':' + m.options : ''}`;
        args.push('-v', spec);
    }
    args.push('-w', opts.workdir);
    if (opts.env) {
        for (const [k, v] of Object.entries(opts.env)) {
            args.push('-e', `${k}=${v}`);
        }
    }
    args.push(opts.image);
    const entry = opts.containerEntrypoint ?? 'php';
    args.push(entry);
    if (opts.phpArgs?.length) {
        args.push(...opts.phpArgs);
    }
    args.push(opts.entrypointPathInContainer);
    return { command: 'docker', args };
}
function buildComposeExecCommand(opts) {
    const args = ['compose', 'exec', '-T'];
    if (opts.user) {
        args.push('-u', opts.user);
    }
    if (opts.workdir) {
        args.push('-w', opts.workdir);
    }
    if (opts.env) {
        for (const [k, v] of Object.entries(opts.env)) {
            args.push('-e', `${k}=${v}`);
        }
    }
    args.push(opts.service);
    args.push('php');
    if (opts.phpArgs?.length) {
        args.push(...opts.phpArgs);
    }
    args.push(opts.entrypointPathInService);
    return { command: 'docker', args };
}
//# sourceMappingURL=command-builder.js.map