"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForUpdates = checkForUpdates;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const CHECK_INTERVAL_HOURS = 24;
const LAST_CHECK_KEY = 'flutter-skill.lastUpdateCheck';
const SKIPPED_VERSION_KEY = 'flutter-skill.skippedVersion';
/**
 * Check npm registry for latest version
 */
async function getLatestVersion() {
    return new Promise((resolve) => {
        const req = https.get('https://registry.npmjs.org/flutter-skill', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json['dist-tags'].latest);
                }
                catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve(null);
        });
    });
}
/**
 * Compare semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2)
            return 1;
        if (p1 < p2)
            return -1;
    }
    return 0;
}
/**
 * Check for updates and notify user if new version available
 */
async function checkForUpdates(currentVersion, context, outputChannel) {
    // Check if we should check (once per 24 hours)
    const lastCheck = context.globalState.get(LAST_CHECK_KEY) || 0;
    const now = Date.now();
    const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);
    if (hoursSinceLastCheck < CHECK_INTERVAL_HOURS) {
        return;
    }
    // Update last check time
    await context.globalState.update(LAST_CHECK_KEY, now);
    outputChannel.appendLine('[Update] Checking for updates...');
    const latestVersion = await getLatestVersion();
    if (!latestVersion) {
        outputChannel.appendLine('[Update] Could not check for updates');
        return;
    }
    outputChannel.appendLine(`[Update] Current: ${currentVersion}, Latest: ${latestVersion}`);
    // Check if update available
    if (compareVersions(latestVersion, currentVersion) <= 0) {
        outputChannel.appendLine('[Update] Already on latest version');
        return;
    }
    // Check if user skipped this version
    const skippedVersion = context.globalState.get(SKIPPED_VERSION_KEY);
    if (skippedVersion === latestVersion) {
        outputChannel.appendLine('[Update] User skipped this version');
        return;
    }
    // Show update notification
    const selection = await vscode.window.showInformationMessage(`Flutter Skill ${latestVersion} is available (current: ${currentVersion})`, 'Update Now', 'View Changes', 'Skip This Version');
    if (selection === 'Update Now') {
        // Open VSCode extension marketplace
        vscode.env.openExternal(vscode.Uri.parse('vscode:extension/ai-dashboad.flutter-skill'));
    }
    else if (selection === 'View Changes') {
        vscode.env.openExternal(vscode.Uri.parse(`https://github.com/ai-dashboad/flutter-skill/releases/tag/v${latestVersion}`));
    }
    else if (selection === 'Skip This Version') {
        await context.globalState.update(SKIPPED_VERSION_KEY, latestVersion);
    }
}
//# sourceMappingURL=updateChecker.js.map