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
exports.detectAiAgents = detectAiAgents;
exports.mergeMcpConfig = mergeMcpConfig;
exports.configureAgent = configureAgent;
exports.configureAllAgents = configureAllAgents;
exports.checkExistingConfigs = checkExistingConfigs;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process = __importStar(require("child_process"));
const FLUTTER_SKILL_MCP_CONFIG = {
    command: 'flutter-skill',
    args: ['server']
};
/**
 * Detects which AI agents are installed on the system
 */
function detectAiAgents() {
    const homeDir = os.homedir();
    const agents = [];
    // Claude Code - check for ~/.claude/ directory or claude command
    // Claude Code uses ~/.claude/settings.json for MCP config
    const claudeDir = path.join(homeDir, '.claude');
    const claudeConfigPath = path.join(claudeDir, 'settings.json');
    const claudeDetected = fs.existsSync(claudeDir) || isCommandAvailable('claude');
    agents.push({
        name: 'claude-code',
        displayName: 'Claude Code',
        configPath: claudeConfigPath,
        detected: claudeDetected
    });
    // Also check for project-level .mcp.json for Claude Code
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const projectMcpPath = path.join(workspaceFolder.uri.fsPath, '.mcp.json');
        agents.push({
            name: 'claude-code-project',
            displayName: 'Claude Code (Project)',
            configPath: projectMcpPath,
            detected: fs.existsSync(projectMcpPath) || claudeDetected
        });
    }
    // Cursor - check for ~/.cursor/ directory
    const cursorDir = path.join(homeDir, '.cursor');
    const cursorConfigPath = path.join(cursorDir, 'mcp.json');
    agents.push({
        name: 'cursor',
        displayName: 'Cursor',
        configPath: cursorConfigPath,
        detected: fs.existsSync(cursorDir)
    });
    // Windsurf - check for ~/.codeium/windsurf/ directory
    const windsurfDir = path.join(homeDir, '.codeium', 'windsurf');
    const windsurfConfigPath = path.join(windsurfDir, 'mcp_config.json');
    agents.push({
        name: 'windsurf',
        displayName: 'Windsurf',
        configPath: windsurfConfigPath,
        detected: fs.existsSync(windsurfDir)
    });
    return agents;
}
/**
 * Check if a command is available in PATH
 */
function isCommandAvailable(command) {
    try {
        const result = child_process.spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { stdio: 'pipe' });
        return result.status === 0;
    }
    catch {
        return false;
    }
}
/**
 * Creates a backup of the config file
 */
function backupConfig(configPath) {
    if (!fs.existsSync(configPath)) {
        return null;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup-${timestamp}`;
    fs.copyFileSync(configPath, backupPath);
    return backupPath;
}
/**
 * Merges flutter-skill MCP config into existing config non-destructively
 */
function mergeMcpConfig(configPath) {
    try {
        // Ensure parent directory exists
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        let existingConfig = {};
        let backupPath = null;
        // Read existing config if it exists
        if (fs.existsSync(configPath)) {
            backupPath = backupConfig(configPath);
            const content = fs.readFileSync(configPath, 'utf-8');
            try {
                existingConfig = JSON.parse(content);
            }
            catch {
                return { success: false, error: 'Invalid JSON in existing config file' };
            }
        }
        // Check if flutter-skill is already configured
        if (existingConfig.mcpServers?.['flutter-skill']) {
            return { success: true, backupPath: backupPath || undefined };
        }
        // Merge the config
        if (!existingConfig.mcpServers) {
            existingConfig.mcpServers = {};
        }
        existingConfig.mcpServers['flutter-skill'] = FLUTTER_SKILL_MCP_CONFIG;
        // Write back with pretty JSON
        fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2) + '\n', 'utf-8');
        return { success: true, backupPath: backupPath || undefined };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
/**
 * Configure a single agent
 */
function configureAgent(agent) {
    return mergeMcpConfig(agent.configPath);
}
/**
 * Main orchestration function - prompts user and configures all detected agents
 */
async function configureAllAgents(outputChannel) {
    const agents = detectAiAgents();
    const detectedAgents = agents.filter(a => a.detected);
    if (detectedAgents.length === 0) {
        vscode.window.showInformationMessage('No AI agents detected. Install Claude Code, Cursor, or Windsurf to use Flutter Skill MCP integration.');
        return;
    }
    // Build list of agents to show
    const agentNames = detectedAgents.map(a => a.displayName).join(', ');
    const message = `Flutter Skill detected these AI agents: ${agentNames}. Configure MCP integration?`;
    const selection = await vscode.window.showInformationMessage(message, 'Configure All', 'Choose Agents', 'Skip');
    if (selection === 'Skip' || !selection) {
        return;
    }
    let agentsToConfig = detectedAgents;
    if (selection === 'Choose Agents') {
        const items = detectedAgents.map(a => ({
            label: a.displayName,
            description: a.configPath,
            picked: true,
            agent: a
        }));
        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select agents to configure'
        });
        if (!selected || selected.length === 0) {
            return;
        }
        agentsToConfig = selected.map(s => s.agent);
    }
    // Configure each selected agent
    const results = [];
    for (const agent of agentsToConfig) {
        const result = configureAgent(agent);
        results.push({ agent, result });
        outputChannel.appendLine(`[Config] ${agent.displayName}: ${result.success ? 'success' : result.error}`);
        if (result.backupPath) {
            outputChannel.appendLine(`[Config] Backup created: ${result.backupPath}`);
        }
    }
    // Show summary
    const successCount = results.filter(r => r.result.success).length;
    const failCount = results.filter(r => !r.result.success).length;
    if (failCount === 0) {
        vscode.window.showInformationMessage(`Flutter Skill MCP configured for ${successCount} agent(s). Restart your AI agents to use the tools.`);
    }
    else {
        const failedAgents = results
            .filter(r => !r.result.success)
            .map(r => r.agent.displayName)
            .join(', ');
        vscode.window.showWarningMessage(`Configured ${successCount} agent(s). Failed: ${failedAgents}. Check output for details.`);
        outputChannel.show();
    }
}
/**
 * Check if any agent already has flutter-skill configured
 */
function checkExistingConfigs() {
    const agents = detectAiAgents();
    const configured = [];
    for (const agent of agents) {
        if (fs.existsSync(agent.configPath)) {
            try {
                const content = fs.readFileSync(agent.configPath, 'utf-8');
                const config = JSON.parse(content);
                if (config.mcpServers?.['flutter-skill']) {
                    configured.push(agent);
                }
            }
            catch {
                // Ignore parse errors
            }
        }
    }
    return configured;
}
//# sourceMappingURL=mcpConfigManager.js.map