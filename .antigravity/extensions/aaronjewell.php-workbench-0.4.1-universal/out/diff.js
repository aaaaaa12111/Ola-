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
exports.DiffContentProvider = void 0;
const crypto_1 = require("crypto");
const vscode = __importStar(require("vscode"));
/**
 * Content provider for PHP Workbench diff documents
 */
class DiffContentProvider {
    _onDidChange = new vscode.EventEmitter();
    onDidChange = this._onDidChange.event;
    content = new Map();
    /**
     * Sets content for a given URI
     * @param uri - The URI to set content for
     * @param content - The content to set
     */
    setContent(uri, content) {
        this.content.set(uri.toString(), content);
        this._onDidChange.fire(uri);
    }
    /**
     * Provides text document content for the given URI
     * @param uri - The URI to provide content for
     * @returns The content for the URI
     */
    provideTextDocumentContent(uri) {
        return this.content.get(uri.toString()) || '';
    }
    /**
     * Clears stored content to free memory
     */
    clear() {
        this.content.clear();
    }
    /**
     * Opens VS Code's native diff editor to compare raw and transformed code
     *
     * @param context - The extension context
     * @param rawCode - The original raw code
     * @param transformedCode - The transformed code after processing
     */
    async showCodeDiff(rawCode, transformedCode) {
        try {
            // Create URIs for the virtual documents using content hash for deterministic uniqueness
            const originalHash = (0, crypto_1.createHash)('sha256').update(rawCode).digest('hex');
            const processedHash = (0, crypto_1.createHash)('sha256').update(transformedCode).digest('hex');
            const originalUri = vscode.Uri.parse(`php-workbench:${originalHash}.php`);
            const processedUri = vscode.Uri.parse(`php-workbench:${processedHash}.php`);
            // Set content in the provider
            this.setContent(originalUri, rawCode);
            this.setContent(processedUri, transformedCode);
            await vscode.commands.executeCommand('vscode.diff', originalUri, processedUri, 'PHP Workbench: Original ↔ Processed', {
                viewColumn: vscode.ViewColumn.Active,
                preview: true, // won't work if user has disabled preview mode
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open diff editor: ${errorMessage}`);
        }
    }
}
exports.DiffContentProvider = DiffContentProvider;
//# sourceMappingURL=diff.js.map