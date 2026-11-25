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
exports.RpcServer = void 0;
const vscode = __importStar(require("vscode"));
const node_1 = require("vscode-jsonrpc/node");
const assert_1 = __importDefault(require("assert"));
const logger_1 = require("./logger");
const EvalRequest = new node_1.RequestType3('eval');
class RpcServer {
    session;
    errorEmitter = new vscode.EventEmitter();
    onDidError = this.errorEmitter.event;
    exitEmitter = new vscode.EventEmitter();
    onDidExit = this.exitEmitter.event;
    connection;
    constructor(session) {
        this.session = session;
    }
    eval(code, cwd) {
        if (!this.connection) {
            return Promise.reject(new Error('Not connected'));
        }
        return this.connection.sendRequest(EvalRequest, code, cwd, this.session.token);
    }
    dispose() {
        this.connection?.dispose();
        this.session.dispose();
    }
    async listen() {
        await this.session.isReady;
        (0, assert_1.default)(this.session.output(), 'Session output is not available');
        (0, assert_1.default)(this.session.input(), 'Session input is not available');
        this.connection = (0, node_1.createMessageConnection)(new node_1.StreamMessageReader(this.session.output()), new node_1.StreamMessageWriter(this.session.input()));
        this.connection.listen();
        this.session.error()?.on('data', data => {
            logger_1.Logger.appendRaw(data.toString());
        });
        this.session.onDidError(err => {
            logger_1.Logger.error(`Session error: ${String(err)}`);
            this.errorEmitter.fire(err);
            this.dispose();
        });
        this.session.onDidExit(code => {
            logger_1.Logger.info(`Session exited with code ${code}`);
            this.exitEmitter.fire(code);
            this.dispose();
        });
        this.connection.onError(err => {
            vscode.window.showErrorMessage(`PHP Workbench: connection error: ${err}`);
            logger_1.Logger.error(`Connection error: ${String(err)}`);
            this.errorEmitter.fire(err);
            this.dispose();
        });
        this.connection.onClose(() => {
            logger_1.Logger.info('Connection closed');
            this.exitEmitter.fire(0);
            this.dispose();
        });
    }
}
exports.RpcServer = RpcServer;
//# sourceMappingURL=rpc.js.map