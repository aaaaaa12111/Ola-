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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const diff_1 = require("./diff");
const rpc_1 = require("./rpc");
const entrypoint_1 = require("./entrypoint");
const node_path_1 = __importDefault(require("node:path"));
const session_1 = require("./session");
const results_1 = require("./results");
const logger_1 = require("./logger");
let rpc;
async function createRpcServer(context) {
    if (rpc) {
        rpc.dispose();
    }
    const entrypoint = await (0, entrypoint_1.getPhpEntrypoint)(context);
    logger_1.Logger.info(`Using entrypoint: ${entrypoint}`);
    const config = vscode.workspace.getConfiguration('phpWorkbench');
    const debugEnabled = config.get('debug');
    const logFile = config.get('logFile');
    const timeout = config.get('timeout');
    if (debugEnabled) {
        logger_1.Logger.info(`Debug enabled`);
    }
    if (logFile) {
        logger_1.Logger.info(`Log file: ${logFile}`);
    }
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
        node_path_1.default.dirname(vscode.window.activeTextEditor?.document.uri.fsPath || '');
    logger_1.Logger.info(`Using cwd: ${cwd}`);
    const session = new session_1.Session({
        command: 'php',
        args: [entrypoint],
        env: {
            ...process.env,
            ...(debugEnabled ? { PHP_WORKBENCH_DEBUG: '1' } : {}),
            ...(logFile ? { PHP_WORKBENCH_LOG: logFile } : {}),
            ...(timeout ? { PHP_WORKBENCH_TIMEOUT: timeout.toString() } : {}),
        },
        cwd,
    });
    logger_1.Logger.info('Executing background session task');
    const execution = await vscode.tasks.executeTask(session.task);
    rpc = new rpc_1.RpcServer(session);
    await rpc.listen();
    logger_1.Logger.info(`RPC server listening`);
    rpc.onDidError(error => {
        vscode.window.showErrorMessage(`PHP Workbench: ${error}`);
        execution.terminate();
        rpc = undefined;
    });
    rpc.onDidExit(code => {
        vscode.window.showInformationMessage(`PHP Workbench: Session exited with code ${code}`);
        execution.terminate();
        rpc = undefined;
    });
    return rpc;
}
/**
 * Called by VS Code when the extension is activated.
 *
 * Registers the commands for the PHP Workbench extension.
 *
 * @param context - The extension context
 */
function activate(context) {
    const diffProvider = new diff_1.DiffContentProvider();
    const providerRegistration = vscode.workspace.registerTextDocumentContentProvider('php-workbench', diffProvider);
    const resultsViewProvider = new results_1.ResultsViewProvider(context.extensionUri, diffProvider);
    const resultsViewRegistration = vscode.window.registerWebviewViewProvider('phpWorkbench.results', resultsViewProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
    });
    // The commandId parameter must match the command field in package.json
    const newScratchpadCommand = vscode.commands.registerCommand('phpWorkbench.newScratchpad', async () => {
        try {
            if (!rpc) {
                rpc = await createRpcServer(context);
            }
            const document = await vscode.workspace.openTextDocument({
                language: 'php',
                content: '<?php\n\n',
            });
            const editor = await vscode.window.showTextDocument(document);
            // Position cursor at the end of the file
            const endPosition = editor.document.positionAt(editor.document.getText().length);
            editor.selection = new vscode.Selection(endPosition, endPosition);
        }
        catch (error) {
            await vscode.window.showErrorMessage(`Failed to create scratchpad: ${error}`);
        }
    });
    const restartSessionCommand = vscode.commands.registerCommand('phpWorkbench.restartSession', async () => {
        try {
            await createRpcServer(context);
            vscode.window.showInformationMessage('PHP Workbench: Session restarted');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to restart session: ${error}`);
        }
    });
    const executeCodeCommand = vscode.commands.registerCommand('phpWorkbench.executeCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return { error: 'No active editor' };
        }
        try {
            const code = !editor.selection.isEmpty
                ? editor.document.getText(editor.selection)
                : editor.document.getText();
            await resultsViewProvider.startExecution();
            if (!rpc) {
                rpc = await createRpcServer(context);
            }
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
                node_path_1.default.dirname(vscode.window.activeTextEditor?.document.uri.fsPath || '');
            const result = await rpc.eval(code, cwd);
            await resultsViewProvider.displayResult({ result });
            return { result };
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            await resultsViewProvider.displayResult({ error });
            return { error };
        }
    });
    const reportIssueCommand = vscode.commands.registerCommand('phpWorkbench.reportIssue', async () => {
        const issueBodyBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(context.asAbsolutePath('res/issue-report.md')));
        return vscode.commands.executeCommand('workbench.action.openIssueReporter', {
            extensionId: 'aaronjewell.php-workbench',
            issueBody: issueBodyBuffer.toString(),
        });
    });
    context.subscriptions.push(newScratchpadCommand, executeCodeCommand, restartSessionCommand, reportIssueCommand, providerRegistration, resultsViewRegistration);
}
/**
 * Called by VS Code when the extension is deactivated.
 */
function deactivate() {
    if (rpc) {
        rpc.dispose();
        rpc = undefined;
    }
    logger_1.Logger.dispose();
}
//# sourceMappingURL=extension.js.map