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
exports.StatusBar = void 0;
exports.showStatusMenu = showStatusMenu;
const vscode = __importStar(require("vscode"));
class StatusBar {
    constructor() {
        this.currentState = 'disconnected';
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'flutter-skill.showStatus';
        this.update('disconnected');
        this.statusBarItem.show();
    }
    /**
     * Update the status bar with the current connection state
     */
    update(state, service) {
        this.currentState = state;
        switch (state) {
            case 'disconnected':
                this.statusBarItem.text = '$(debug-disconnect) Flutter Skill';
                this.statusBarItem.tooltip = 'No Flutter app connected. Click for options.';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'connecting':
                this.statusBarItem.text = '$(sync~spin) Flutter Skill';
                this.statusBarItem.tooltip = 'Connecting to Flutter app...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'connected':
                this.statusBarItem.text = '$(check) Flutter Skill';
                this.statusBarItem.tooltip = service
                    ? `Connected to Flutter app on port ${service.port}`
                    : 'Connected to Flutter app';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'error':
                this.statusBarItem.text = '$(error) Flutter Skill';
                this.statusBarItem.tooltip = 'Connection error. Click for options.';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
        }
    }
    /**
     * Get the current state
     */
    getState() {
        return this.currentState;
    }
    /**
     * Show the status bar item
     */
    show() {
        this.statusBarItem.show();
    }
    /**
     * Hide the status bar item
     */
    hide() {
        this.statusBarItem.hide();
    }
    /**
     * Dispose of the status bar item
     */
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBar = StatusBar;
/**
 * Show status menu with options based on current state
 */
async function showStatusMenu(state, commands) {
    const items = [];
    if (state === 'disconnected' || state === 'error') {
        items.push({
            label: '$(rocket) Launch Flutter App',
            description: 'Start a Flutter app with Flutter Skill',
            action: commands.launch
        });
        items.push({
            label: '$(search) Scan for Running Apps',
            description: 'Scan ports for running Flutter apps',
            action: commands.rescan
        });
    }
    if (state === 'connected') {
        items.push({
            label: '$(list-tree) Inspect UI',
            description: 'View the widget tree of the running app',
            action: commands.inspect
        });
    }
    items.push({
        label: '$(settings-gear) Configure AI Agents',
        description: 'Set up MCP integration for Claude Code, Cursor, Windsurf',
        action: commands.configureAgents
    });
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Flutter Skill Options'
    });
    if (selected?.action) {
        await selected.action();
    }
}
//# sourceMappingURL=statusBar.js.map