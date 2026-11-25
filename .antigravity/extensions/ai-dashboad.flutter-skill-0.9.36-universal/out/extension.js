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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const mcpConfigManager_1 = require("./mcpConfigManager");
const vmServiceScanner_1 = require("./vmServiceScanner");
const statusBar_1 = require("./statusBar");
const flutterSetup_1 = require("./flutterSetup");
const nativeBinary_1 = require("./nativeBinary");
const updateChecker_1 = require("./updateChecker");
const FlutterSkillViewProvider_1 = require("./views/FlutterSkillViewProvider");
// Read version from package.json dynamically
function getExtensionVersion() {
    try {
        const packageJsonPath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.version;
    }
    catch (error) {
        console.error('Failed to read version from package.json:', error);
        return '0.0.0'; // Fallback version
    }
}
const EXTENSION_VERSION = getExtensionVersion();
let mcpServerProcess;
let outputChannel;
let statusBar;
let vmScanner;
let viewProvider;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Flutter Skill');
    statusBar = new statusBar_1.StatusBar();
    vmScanner = new vmServiceScanner_1.VmServiceScanner(outputChannel);
    // Create webview view provider
    viewProvider = new FlutterSkillViewProvider_1.FlutterSkillViewProvider(context.extensionUri, outputChannel, vmScanner);
    // Register webview view provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('flutterSkillView', viewProvider, { webviewOptions: { retainContextWhenHidden: true } }));
    // Connect scanner state changes to status bar and webview
    vmScanner.onStateChange((state, service) => {
        statusBar.update(state, service);
        viewProvider.updateConnectionStatus(state, service);
    });
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('flutter-skill.launch', launchApp), vscode.commands.registerCommand('flutter-skill.inspect', inspectUI), vscode.commands.registerCommand('flutter-skill.screenshot', takeScreenshot), vscode.commands.registerCommand('flutter-skill.startMcpServer', startMcpServer), vscode.commands.registerCommand('flutter-skill.stopMcpServer', stopMcpServer), vscode.commands.registerCommand('flutter-skill.configureAgents', () => (0, mcpConfigManager_1.configureAllAgents)(outputChannel)), vscode.commands.registerCommand('flutter-skill.rescan', () => vmScanner.rescan()), vscode.commands.registerCommand('flutter-skill.showStatus', showStatus), vscode.commands.registerCommand('flutter-skill.setupDependency', () => setupFlutterSkillCommand()));
    // Add status bar and scanner to subscriptions for cleanup
    context.subscriptions.push(statusBar);
    context.subscriptions.push({ dispose: () => vmScanner.stop() });
    // Check if this is a Flutter project
    const isFlutterProject = checkIsFlutterProject();
    if (isFlutterProject) {
        outputChannel.appendLine('Flutter project detected');
        // Auto-initialization based on settings
        const config = vscode.workspace.getConfiguration('flutter-skill');
        // Auto-start MCP server if configured
        if (config.get('autoStartMcpServer')) {
            startMcpServer();
        }
        // Start VM service scanning if configured
        if (config.get('scanVmServicePorts')) {
            vmScanner.start();
        }
        // Prompt to configure AI agents if configured and not already done
        if (config.get('autoConfigureAgents')) {
            promptConfigureAgentsIfNeeded();
        }
        // Auto-setup flutter_skill dependency if configured
        if (config.get('autoSetupDependency')) {
            (0, flutterSetup_1.promptSetupFlutterSkill)(outputChannel);
        }
        // Download native binary in background for faster MCP startup
        (0, nativeBinary_1.ensureNativeBinary)(EXTENSION_VERSION, outputChannel);
    }
    // Check for updates (once per 24 hours)
    (0, updateChecker_1.checkForUpdates)(EXTENSION_VERSION, context, outputChannel);
    outputChannel.appendLine('Flutter Skill extension activated');
}
function deactivate() {
    if (mcpServerProcess) {
        mcpServerProcess.kill();
    }
    vmScanner?.stop();
}
/**
 * Check if the current workspace is a Flutter project
 */
function checkIsFlutterProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return false;
    }
    const pubspecPath = path.join(workspaceFolder.uri.fsPath, 'pubspec.yaml');
    if (!fs.existsSync(pubspecPath)) {
        return false;
    }
    // Check if pubspec contains flutter dependency
    try {
        const content = fs.readFileSync(pubspecPath, 'utf-8');
        return content.includes('flutter:') || content.includes('flutter_test:');
    }
    catch {
        return false;
    }
}
/**
 * Prompt to configure AI agents if not already configured
 */
async function promptConfigureAgentsIfNeeded() {
    // Check if any agents are detected but not configured
    const agents = (0, mcpConfigManager_1.detectAiAgents)();
    const detectedAgents = agents.filter(a => a.detected);
    const configuredAgents = (0, mcpConfigManager_1.checkExistingConfigs)();
    // If no agents detected or all are configured, skip
    if (detectedAgents.length === 0) {
        return;
    }
    // Check if flutter-skill is already configured for any detected agent
    const unconfiguredAgents = detectedAgents.filter(detected => !configuredAgents.some(configured => configured.name === detected.name));
    if (unconfiguredAgents.length === 0) {
        outputChannel.appendLine('All detected AI agents already have flutter-skill configured');
        return;
    }
    // Show notification with option to configure
    const agentNames = unconfiguredAgents.map(a => a.displayName).join(', ');
    const message = `Configure Flutter Skill MCP for ${agentNames}?`;
    const selection = await vscode.window.showInformationMessage(message, 'Configure', 'Later', "Don't Ask Again");
    if (selection === 'Configure') {
        await (0, mcpConfigManager_1.configureAllAgents)(outputChannel);
    }
    else if (selection === "Don't Ask Again") {
        const config = vscode.workspace.getConfiguration('flutter-skill');
        await config.update('autoConfigureAgents', false, vscode.ConfigurationTarget.Global);
    }
}
/**
 * Show status menu
 */
async function showStatus() {
    const state = statusBar.getState();
    await (0, statusBar_1.showStatusMenu)(state, {
        launch: launchApp,
        inspect: inspectUI,
        rescan: async () => { await vmScanner.rescan(); },
        configureAgents: () => (0, mcpConfigManager_1.configureAllAgents)(outputChannel)
    });
}
async function launchApp() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const config = vscode.workspace.getConfiguration('flutter-skill');
    const dartPath = config.get('dartPath') || 'dart';
    // Check for pubspec.yaml
    const pubspecPath = path.join(workspaceFolder.uri.fsPath, 'pubspec.yaml');
    if (!fs.existsSync(pubspecPath)) {
        vscode.window.showErrorMessage('No pubspec.yaml found. Is this a Flutter project?');
        return;
    }
    // Run flutter_skill launch
    const terminal = vscode.window.createTerminal('Flutter Skill');
    terminal.show();
    terminal.sendText(`${dartPath} pub global run flutter_skill launch .`);
    vscode.window.showInformationMessage('Launching Flutter app with Flutter Skill...');
}
async function inspectUI() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const config = vscode.workspace.getConfiguration('flutter-skill');
    const dartPath = config.get('dartPath') || 'dart';
    // Check for .flutter_skill_uri
    const uriFile = path.join(workspaceFolder.uri.fsPath, '.flutter_skill_uri');
    if (!fs.existsSync(uriFile)) {
        vscode.window.showErrorMessage('No running Flutter app found. Launch an app first.');
        return;
    }
    // Run inspect command
    const terminal = vscode.window.createTerminal('Flutter Skill Inspect');
    terminal.show();
    terminal.sendText(`${dartPath} pub global run flutter_skill inspect`);
}
async function takeScreenshot() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const config = vscode.workspace.getConfiguration('flutter-skill');
    const dartPath = config.get('dartPath') || 'dart';
    // Check for .flutter_skill_uri
    const uriFile = path.join(workspaceFolder.uri.fsPath, '.flutter_skill_uri');
    if (!fs.existsSync(uriFile)) {
        vscode.window.showErrorMessage('No running Flutter app found. Launch an app first.');
        return;
    }
    // Get save location
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'screenshot.png')),
        filters: { 'Images': ['png'] }
    });
    if (!saveUri)
        return;
    // Run screenshot command
    const terminal = vscode.window.createTerminal('Flutter Skill Screenshot');
    terminal.show();
    terminal.sendText(`${dartPath} pub global run flutter_skill screenshot "${saveUri.fsPath}"`);
    vscode.window.showInformationMessage(`Screenshot will be saved to ${saveUri.fsPath}`);
}
async function startMcpServer() {
    if (mcpServerProcess) {
        vscode.window.showInformationMessage('MCP Server is already running');
        return;
    }
    // Get the best available binary (native or dart fallback)
    const { path: binaryPath, isNative } = await (0, nativeBinary_1.getBestBinaryPath)(EXTENSION_VERSION, outputChannel);
    if (isNative) {
        outputChannel.appendLine(`[MCP] Using native binary: ${binaryPath}`);
        mcpServerProcess = child_process.spawn(binaryPath, ['server'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
    }
    else {
        outputChannel.appendLine('[MCP] Using Dart runtime (native binary not available)');
        const config = vscode.workspace.getConfiguration('flutter-skill');
        const dartPath = config.get('dartPath') || 'dart';
        mcpServerProcess = child_process.spawn(dartPath, ['pub', 'global', 'run', 'flutter_skill', 'server'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
    }
    mcpServerProcess.stdout?.on('data', (data) => {
        outputChannel.appendLine(`[MCP] ${data}`);
    });
    mcpServerProcess.stderr?.on('data', (data) => {
        outputChannel.appendLine(`[MCP Error] ${data}`);
    });
    mcpServerProcess.on('close', (code) => {
        outputChannel.appendLine(`MCP Server exited with code ${code}`);
        mcpServerProcess = undefined;
    });
    outputChannel.appendLine('Flutter Skill MCP Server started');
}
async function stopMcpServer() {
    if (!mcpServerProcess) {
        vscode.window.showInformationMessage('MCP Server is not running');
        return;
    }
    mcpServerProcess.kill();
    mcpServerProcess = undefined;
    vscode.window.showInformationMessage('MCP Server stopped');
}
async function setupFlutterSkillCommand() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    if ((0, flutterSetup_1.hasFlutterSkillDependency)(workspaceFolder.uri.fsPath)) {
        vscode.window.showInformationMessage('flutter_skill is already configured in this project');
        return;
    }
    await (0, flutterSetup_1.setupFlutterSkill)(workspaceFolder.uri.fsPath, outputChannel);
}
//# sourceMappingURL=extension.js.map