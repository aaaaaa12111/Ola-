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
exports.RubyFormattingProvider = void 0;
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const path = __importStar(require("path"));
class RubyFormattingProvider {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    provideDocumentFormattingEdits(document, options, token) {
        return this.format(document);
    }
    provideDocumentRangeFormattingEdits(document, range, options, token) {
        return this.format(document, range);
    }
    async format(document, range) {
        const config = vscode.workspace.getConfiguration('rubymate');
        const rubyPath = config.get('rubyPath', 'ruby');
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const cwd = workspaceFolder?.uri.fsPath || path.dirname(document.fileName);
        try {
            // Check if RuboCop is available
            const rubocopAvailable = await this.checkRuboCopAvailable(cwd);
            if (!rubocopAvailable) {
                vscode.window.showWarningMessage('RuboCop not found. Install it with: gem install rubocop or add to Gemfile', 'Install RuboCop').then(selection => {
                    if (selection === 'Install RuboCop') {
                        const terminal = vscode.window.createTerminal('RuboCop Install');
                        terminal.sendText('gem install rubocop');
                        terminal.show();
                    }
                });
                return [];
            }
            // Format with RuboCop
            const formatted = await this.formatWithRuboCop(document, cwd, range);
            if (formatted === null) {
                return [];
            }
            // Create edit for entire document or range
            const fullRange = range || new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
            return [vscode.TextEdit.replace(fullRange, formatted)];
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Formatting error: ${errorMessage}`);
            // Provide specific, actionable error messages
            if (errorMessage.includes('rubocop') || errorMessage.includes('not found')) {
                vscode.window.showErrorMessage('RuboCop not found. Install it with: gem install rubocop', 'Install RuboCop', 'Show Docs').then(selection => {
                    if (selection === 'Install RuboCop') {
                        const terminal = vscode.window.createTerminal('Install RuboCop');
                        terminal.sendText('gem install rubocop');
                        terminal.show();
                    }
                    else if (selection === 'Show Docs') {
                        vscode.env.openExternal(vscode.Uri.parse('https://docs.rubocop.org/rubocop/installation.html'));
                    }
                });
            }
            else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
                vscode.window.showWarningMessage('Formatting timed out after 30 seconds. File may be too large or RuboCop config is slow.', 'Show Output').then(selection => {
                    if (selection === 'Show Output') {
                        this.outputChannel.show();
                    }
                });
            }
            else if (errorMessage.includes('ENOENT') || errorMessage.includes('command not found')) {
                vscode.window.showErrorMessage('Ruby or RuboCop executable not found. Check your PATH or rubymate.rubyPath setting.', 'Open Settings', 'Show Output').then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'rubymate.rubyPath');
                    }
                    else if (selection === 'Show Output') {
                        this.outputChannel.show();
                    }
                });
            }
            else {
                // Generic error with helpful actions
                vscode.window.showErrorMessage(`Failed to format Ruby file: ${errorMessage}`, 'Show Output', 'Retry').then(selection => {
                    if (selection === 'Show Output') {
                        this.outputChannel.show();
                    }
                    else if (selection === 'Retry') {
                        // Retry formatting
                        vscode.commands.executeCommand('editor.action.formatDocument');
                    }
                });
            }
            return [];
        }
    }
    async checkRuboCopAvailable(cwd) {
        return new Promise((resolve) => {
            // Try bundle exec rubocop first (for projects with Gemfile)
            child_process.exec('bundle exec rubocop --version', { cwd }, (error) => {
                if (!error) {
                    resolve(true);
                    return;
                }
                // Try global rubocop
                child_process.exec('rubocop --version', { cwd }, (error) => {
                    resolve(!error);
                });
            });
        });
    }
    async formatWithRuboCop(document, cwd, range) {
        return new Promise((resolve, reject) => {
            const text = range ? document.getText(range) : document.getText();
            // Use stdin/stdout to format without creating temp files
            const useBundler = this.shouldUseBundler(cwd);
            // FIX: Use array args instead of shell string to prevent command injection
            const args = useBundler
                ? ['bundle', 'exec', 'rubocop', '--auto-correct', '--stdin', '-', '--format', 'quiet', '--stderr']
                : ['rubocop', '--auto-correct', '--stdin', '-', '--format', 'quiet', '--stderr'];
            const command = args[0];
            const commandArgs = args.slice(1);
            // FIX: Add 30-second timeout to prevent hanging
            const timeout = setTimeout(() => {
                rubocop.kill('SIGTERM');
                this.outputChannel.appendLine('RuboCop process timed out after 30 seconds');
                resolve(null);
            }, 30000);
            const rubocop = child_process.spawn(command, commandArgs, {
                cwd,
                shell: false // FIX: Disable shell to prevent injection
            });
            let stdout = '';
            let stderr = '';
            let stdinClosed = false;
            rubocop.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            rubocop.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            rubocop.on('close', (code) => {
                clearTimeout(timeout); // FIX: Clear timeout on completion
                if (stderr && !stderr.includes('no offenses detected')) {
                    this.outputChannel.appendLine(`RuboCop stderr: ${stderr}`);
                }
                // RuboCop returns formatted code on stdout
                if (stdout) {
                    resolve(stdout);
                }
                else if (code === 0) {
                    // No changes needed
                    resolve(text);
                }
                else {
                    this.outputChannel.appendLine(`RuboCop failed with code ${code}`);
                    resolve(null);
                }
            });
            rubocop.on('error', (error) => {
                clearTimeout(timeout); // FIX: Clear timeout on error
                this.outputChannel.appendLine(`RuboCop spawn error: ${error}`);
                // FIX: Close stdin safely on error
                if (!stdinClosed && rubocop.stdin.writable) {
                    rubocop.stdin.end();
                    stdinClosed = true;
                }
                reject(error);
            });
            // Write document content to stdin
            try {
                rubocop.stdin.write(text);
                rubocop.stdin.end();
                stdinClosed = true;
            }
            catch (error) {
                clearTimeout(timeout);
                this.outputChannel.appendLine(`Failed to write to stdin: ${error}`);
                reject(error);
            }
        });
    }
    shouldUseBundler(cwd) {
        const fs = require('fs');
        const gemfilePath = path.join(cwd, 'Gemfile');
        return fs.existsSync(gemfilePath);
    }
}
exports.RubyFormattingProvider = RubyFormattingProvider;
//# sourceMappingURL=rubyFormattingProvider.js.map