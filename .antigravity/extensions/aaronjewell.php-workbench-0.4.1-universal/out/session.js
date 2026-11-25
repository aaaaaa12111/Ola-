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
exports.Session = void 0;
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const vscode = __importStar(require("vscode"));
const logger_1 = require("./logger");
class SessionTask extends vscode.Task {
    static type = 'php-workbench.session';
    static name = 'PHP Workbench: Session';
    static source = 'PHP Workbench';
    terminal;
    constructor() {
        const terminal = new SessionTerminal();
        const execution = new vscode.CustomExecution(() => Promise.resolve(terminal));
        super({ type: SessionTask.type }, vscode.TaskScope.Workspace, SessionTask.name, SessionTask.source, execution);
        this.terminal = terminal;
        this.presentationOptions.focus = false;
        this.presentationOptions.echo = false;
        this.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
        this.presentationOptions.panel = vscode.TaskPanelKind.Dedicated;
        this.presentationOptions.showReuseMessage = false;
        this.isBackground = true;
    }
}
class SessionTerminal {
    writeEmitter = new vscode.EventEmitter();
    onDidWrite = this.writeEmitter.event;
    closeEmitter = new vscode.EventEmitter();
    onDidClose = this.closeEmitter.event;
    openEmitter = new vscode.EventEmitter();
    onDidOpen = this.openEmitter.event;
    open(_initialDimensions) {
        this.openEmitter.fire();
    }
    write(data) {
        this.writeEmitter.fire(data);
    }
    close() {
        this.closeEmitter.fire(0);
    }
}
class Session {
    opts;
    errorEmitter = new vscode.EventEmitter();
    onDidError = this.errorEmitter.event;
    exitEmitter = new vscode.EventEmitter();
    onDidExit = this.exitEmitter.event;
    child;
    stdin = null;
    stdout = null;
    stderr = null;
    isReady;
    task;
    token;
    _terminalCloseListener;
    _terminalOpenListener;
    _disposed = false;
    constructor(opts) {
        this.opts = opts;
        this.task = new SessionTask();
        this.token = this.generateToken();
        this.isReady = new Promise((resolve, reject) => {
            if (!this.task) {
                reject(new Error('Task not initialized'));
                return;
            }
            logger_1.Logger.info(`Session created, waiting for terminal to open`);
            this._terminalOpenListener = this.task.terminal.onDidOpen(() => {
                logger_1.Logger.info(`Terminal opened, spawning child process`);
                this._terminalOpenListener?.dispose();
                this._terminalOpenListener = undefined;
                this.spawnChild();
                resolve(true);
            });
            this._terminalCloseListener = this.task.terminal.onDidClose?.(() => {
                logger_1.Logger.info(`Terminal closed`);
                this._terminalCloseListener?.dispose();
                this._terminalCloseListener = undefined;
                this.dispose();
            });
        });
    }
    dispose() {
        if (this._disposed) {
            return;
        }
        logger_1.Logger.info(`Disposing session`);
        this._disposed = true;
        if (this.child && !this.child.killed) {
            logger_1.Logger.info(`Killing child process`);
            this.child.kill();
        }
        logger_1.Logger.info(`Removing child process listeners`);
        this.child?.removeAllListeners();
        this.child = undefined;
        logger_1.Logger.info(`Ending process streams`);
        this.stdin?.end();
        this.stdout = null;
        this.stderr = null;
        this.stdin = null;
        logger_1.Logger.info(`Closing terminal`);
        this.task?.terminal.close();
        logger_1.Logger.info(`Removing task`);
        this.task = undefined;
    }
    output() {
        return this.stdout;
    }
    error() {
        return this.stderr;
    }
    input() {
        return this.stdin;
    }
    spawnChild() {
        this.child = (0, node_child_process_1.spawn)(this.opts.command, this.opts.args ?? [], {
            cwd: this.opts.cwd,
            env: { ...this.opts.env, PHP_WORKBENCH_TOKEN: this.token },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.child.once('error', err => {
            this.errorEmitter.fire(err);
            this.dispose();
        });
        this.child.once('disconnect', () => {
            this.exitEmitter.fire(0);
            this.dispose();
        });
        this.child.once('exit', (code, sig) => {
            this.exitEmitter.fire(code ?? 0);
            this.dispose();
        });
        this.stdout = this.child.stdout;
        this.stderr = this.child.stderr;
        this.stdin = this.child.stdin;
    }
    /**
     * Generates a secure random token for PHP process authentication
     *
     * @returns A cryptographically secure random token
     */
    generateToken() {
        return (0, node_crypto_1.randomBytes)(32).toString('hex');
    }
}
exports.Session = Session;
//# sourceMappingURL=session.js.map