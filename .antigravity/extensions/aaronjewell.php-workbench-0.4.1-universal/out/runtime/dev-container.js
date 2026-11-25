"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDevContainerLike = detectDevContainerLike;
const containerizedRemotes = [
    'dev-container',
    'codespaces',
];
function detectDevContainerLike(input) {
    const name = (input.remoteName || '').toLowerCase();
    if (containerizedRemotes.includes(name)) {
        return { isContainerized: true, kind: name };
    }
    return { isContainerized: false };
}
//# sourceMappingURL=dev-container.js.map