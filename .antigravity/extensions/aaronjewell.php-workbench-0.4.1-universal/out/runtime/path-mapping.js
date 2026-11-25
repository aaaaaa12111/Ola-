"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapHostToContainer = mapHostToContainer;
exports.mapContainerToHost = mapContainerToHost;
function normalizeWin(p) {
    return p.replace(/\\/g, '/');
}
function ensureNoTrailingSlash(p) {
    return p.endsWith('/') ? p.slice(0, -1) : p;
}
function mapHostToContainer(hostPath, opts) {
    const { hostRoot, containerRoot, platform } = opts;
    const normalizedRoot = platform === 'win32' ? normalizeWin(hostRoot) : hostRoot;
    const normalizedHost = platform === 'win32' ? normalizeWin(hostPath) : hostPath;
    const rootNoSlash = ensureNoTrailingSlash(normalizedRoot);
    const containerNoSlash = ensureNoTrailingSlash(containerRoot);
    if (!normalizedHost.startsWith(rootNoSlash + '/')) {
        return hostPath;
    }
    const rel = normalizedHost.slice(rootNoSlash.length);
    return containerNoSlash + rel;
}
function mapContainerToHost(containerPath, opts) {
    const { hostRoot, containerRoot, platform } = opts;
    const containerNoSlash = ensureNoTrailingSlash(containerRoot);
    const normalizedContainer = containerPath.replace(/\\/g, '/');
    if (!normalizedContainer.startsWith(containerNoSlash + '/')) {
        return containerPath;
    }
    const rel = normalizedContainer.slice(containerNoSlash.length);
    if (opts.platform === 'win32') {
        return (ensureNoTrailingSlash(hostRoot) + rel).replace(/\//g, '\\');
    }
    return ensureNoTrailingSlash(hostRoot) + rel;
}
//# sourceMappingURL=path-mapping.js.map