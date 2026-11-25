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
exports.RubyDocumentSymbolProvider = void 0;
const vscode = __importStar(require("vscode"));
class RubyDocumentSymbolProvider {
    constructor(symbolIndexer) {
        this.symbolIndexer = symbolIndexer;
    }
    provideDocumentSymbols(document, token) {
        if (token.isCancellationRequested || document.languageId !== 'ruby') {
            return [];
        }
        const symbols = this.symbolIndexer.getFileSymbols(document.uri);
        // Group symbols by container for hierarchical view
        const documentSymbols = new Map();
        const rootSymbols = [];
        for (const symbol of symbols) {
            const range = symbol.location.range;
            // Calculate selectionRange ensuring it's contained within range
            const selectionEnd = new vscode.Position(range.start.line, Math.min(range.start.character + symbol.name.length, range.end.character));
            // Ensure selectionRange is valid and contained in range
            const selectionRange = new vscode.Range(range.start, selectionEnd.isAfter(range.end) ? range.end : selectionEnd);
            const docSymbol = new vscode.DocumentSymbol(symbol.name, symbol.detail || '', symbol.kind, range, selectionRange);
            if (symbol.containerName) {
                // Add as child of container
                const container = documentSymbols.get(symbol.containerName);
                if (container) {
                    container.children.push(docSymbol);
                }
                else {
                    // Container not found yet, add to root for now
                    rootSymbols.push(docSymbol);
                }
            }
            else {
                // Top-level symbol
                rootSymbols.push(docSymbol);
                documentSymbols.set(symbol.name, docSymbol);
            }
        }
        return rootSymbols;
    }
}
exports.RubyDocumentSymbolProvider = RubyDocumentSymbolProvider;
//# sourceMappingURL=documentSymbolProvider.js.map