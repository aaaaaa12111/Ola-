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
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Centralized logging utility for the PHP Workbench extension.
 *
 * Why: Provide a single, reusable output channel and consistent logging API
 * across the extension. This replaces ad-hoc channel creation and scattered
 * logging, and enables debug filtering via user configuration.
 */
class Logger {
    static outputChannel;
    /**
     * Lazily creates and returns the extension's output channel.
     * Ensures a single channel instance is used across the extension.
     */
    static getChannel() {
        if (!Logger.outputChannel) {
            Logger.outputChannel = vscode.window.createOutputChannel('PHP Workbench', { log: true });
        }
        return Logger.outputChannel;
    }
    /**
     * Writes an informational message to the output channel.
     */
    static info(message) {
        Logger.getChannel().info(message);
    }
    /**
     * Writes a warning message to the output channel.
     */
    static warn(message) {
        Logger.getChannel().warn(message);
    }
    /**
     * Writes an error message to the output channel.
     */
    static error(message) {
        Logger.getChannel().error(message);
    }
    /**
     * Writes a debug message to the output channel when debug is enabled.
     * Debug is controlled by the `phpWorkbench.debug` configuration.
     */
    static debug(message) {
        Logger.getChannel().debug(message);
    }
    /**
     * Appends a message line as-is without prefixes. Useful for piping
     * process output directly to the channel.
     */
    static appendRaw(line) {
        Logger.getChannel().appendLine(line);
    }
    /**
     * Disposes the output channel. Intended for extension deactivation.
     */
    static dispose() {
        Logger.outputChannel?.dispose();
        Logger.outputChannel = undefined;
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map