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
exports.getBinaryName = getBinaryName;
exports.getLocalBinaryPath = getLocalBinaryPath;
exports.hasNativeBinary = hasNativeBinary;
exports.downloadNativeBinary = downloadNativeBinary;
exports.getBestBinaryPath = getBestBinaryPath;
exports.ensureNativeBinary = ensureNativeBinary;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const https = __importStar(require("https"));
const CACHE_DIR = path.join(os.homedir(), '.flutter-skill');
const BIN_DIR = path.join(CACHE_DIR, 'bin');
/**
 * Get platform-specific binary name
 */
function getBinaryName() {
    const platform = os.platform();
    const arch = os.arch();
    if (platform === 'darwin') {
        return arch === 'arm64' ? 'flutter-skill-macos-arm64' : 'flutter-skill-macos-x64';
    }
    else if (platform === 'linux') {
        return 'flutter-skill-linux-x64';
    }
    else if (platform === 'win32') {
        return 'flutter-skill-windows-x64.exe';
    }
    return null;
}
/**
 * Get the local binary path for a specific version
 */
function getLocalBinaryPath(version) {
    const binaryName = getBinaryName();
    if (!binaryName)
        return null;
    return path.join(BIN_DIR, `${binaryName}-v${version}`);
}
/**
 * Check if native binary exists for the given version
 */
function hasNativeBinary(version) {
    const binaryPath = getLocalBinaryPath(version);
    return binaryPath !== null && fs.existsSync(binaryPath);
}
/**
 * Download native binary from GitHub releases
 */
async function downloadNativeBinary(version, outputChannel, progress) {
    const binaryName = getBinaryName();
    if (!binaryName) {
        outputChannel.appendLine('[Native] No native binary available for this platform');
        return null;
    }
    const localPath = getLocalBinaryPath(version);
    if (!localPath)
        return null;
    // Already exists
    if (fs.existsSync(localPath)) {
        outputChannel.appendLine(`[Native] Binary already exists at ${localPath}`);
        return localPath;
    }
    const downloadUrl = `https://github.com/ai-dashboad/flutter-skill/releases/download/v${version}/${binaryName}`;
    outputChannel.appendLine(`[Native] Downloading from ${downloadUrl}`);
    progress?.report({ message: 'Downloading native binary...' });
    return new Promise((resolve) => {
        // Ensure directory exists
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        const file = fs.createWriteStream(localPath);
        const request = (url) => {
            https.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 302 || response.statusCode === 301) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        request(redirectUrl);
                    }
                    else {
                        outputChannel.appendLine('[Native] Redirect without location header');
                        resolve(null);
                    }
                    return;
                }
                if (response.statusCode !== 200) {
                    outputChannel.appendLine(`[Native] Download failed: HTTP ${response.statusCode}`);
                    fs.unlink(localPath, () => { });
                    resolve(null);
                    return;
                }
                const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedBytes = 0;
                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (totalBytes > 0) {
                        const percent = Math.round((downloadedBytes / totalBytes) * 100);
                        progress?.report({ message: `Downloading... ${percent}%` });
                    }
                });
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    // Make executable
                    fs.chmodSync(localPath, 0o755);
                    outputChannel.appendLine(`[Native] Downloaded to ${localPath}`);
                    resolve(localPath);
                });
                file.on('error', (err) => {
                    outputChannel.appendLine(`[Native] Write error: ${err.message}`);
                    fs.unlink(localPath, () => { });
                    resolve(null);
                });
            }).on('error', (err) => {
                outputChannel.appendLine(`[Native] Download error: ${err.message}`);
                fs.unlink(localPath, () => { });
                resolve(null);
            });
        };
        request(downloadUrl);
    });
}
/**
 * Get the best available binary path (native or fallback to dart command)
 */
async function getBestBinaryPath(version, outputChannel) {
    // Check if native binary exists
    const localPath = getLocalBinaryPath(version);
    if (localPath && fs.existsSync(localPath)) {
        return { path: localPath, isNative: true };
    }
    // Try to download
    const downloaded = await downloadNativeBinary(version, outputChannel);
    if (downloaded) {
        return { path: downloaded, isNative: true };
    }
    // Fallback to flutter-skill command (from PATH)
    return { path: 'flutter-skill', isNative: false };
}
/**
 * Ensure native binary is available (download if needed)
 */
async function ensureNativeBinary(version, outputChannel) {
    if (hasNativeBinary(version)) {
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Flutter Skill',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Installing native binary for faster startup...' });
        const result = await downloadNativeBinary(version, outputChannel, progress);
        if (result) {
            vscode.window.showInformationMessage('Flutter Skill native binary installed!');
        }
    });
}
//# sourceMappingURL=nativeBinary.js.map