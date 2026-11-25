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
exports.RubyCallHierarchyProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Provides call hierarchy like IDE Ctrl+Alt+H
 * Shows incoming calls (who calls this method) and outgoing calls (what this method calls)
 */
class RubyCallHierarchyProvider {
    constructor(indexer) {
        this.indexer = indexer;
    }
    async prepareCallHierarchy(document, position, token) {
        if (token.isCancellationRequested) {
            return undefined;
        }
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        // Find methods with this name
        const symbols = this.indexer.findSymbols(word, vscode.SymbolKind.Method);
        if (symbols.length === 0) {
            // Also try functions
            const functionSymbols = this.indexer.findSymbols(word, vscode.SymbolKind.Function);
            if (functionSymbols.length === 0) {
                return undefined;
            }
            symbols.push(...functionSymbols);
        }
        // Create CallHierarchyItems
        return symbols.map(symbol => {
            const containerName = symbol.containerName || 'Global';
            return new vscode.CallHierarchyItem(vscode.SymbolKind.Method, symbol.name, `in ${containerName}`, symbol.location.uri, symbol.location.range, symbol.location.range);
        });
    }
    async provideCallHierarchyIncomingCalls(item, token) {
        if (token.isCancellationRequested) {
            return undefined;
        }
        const incomingCalls = [];
        // Search all Ruby files for calls to this method
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return undefined;
        }
        for (const folder of workspaceFolders) {
            const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*.rb'), '**/node_modules/**');
            for (const fileUri of files) {
                if (token.isCancellationRequested) {
                    break;
                }
                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const calls = await this.findMethodCalls(document, item.name);
                    for (const call of calls) {
                        // Find the method that contains this call
                        const containingMethod = this.findContainingMethod(document, call.range.start);
                        if (containingMethod) {
                            const fromItem = new vscode.CallHierarchyItem(vscode.SymbolKind.Method, containingMethod.name, containingMethod.containerName || '', document.uri, containingMethod.range, containingMethod.range);
                            incomingCalls.push(new vscode.CallHierarchyIncomingCall(fromItem, [call.range]));
                        }
                    }
                }
                catch (error) {
                    // Skip files that can't be read
                    continue;
                }
            }
        }
        return incomingCalls.length > 0 ? incomingCalls : undefined;
    }
    async provideCallHierarchyOutgoingCalls(item, token) {
        if (token.isCancellationRequested) {
            return undefined;
        }
        const outgoingCalls = [];
        try {
            const document = await vscode.workspace.openTextDocument(item.uri);
            const methodBody = document.getText(item.range);
            // Find all method calls within this method
            // Matches: .method_name, method_name(), self.method_name
            const callPatterns = [
                /\.(\w+)/g, // .method_name
                /(\w+)\s*\(/g, // method_name(
                /self\.(\w+)/g, // self.method_name
                /super/g, // super calls
            ];
            const calledMethods = new Set();
            for (const pattern of callPatterns) {
                let match;
                while ((match = pattern.exec(methodBody)) !== null) {
                    if (match[1]) {
                        calledMethods.add(match[1]);
                    }
                    else if (match[0] === 'super') {
                        calledMethods.add(item.name); // super calls the same method name in parent
                    }
                }
            }
            // For each called method, try to find its definition
            for (const methodName of calledMethods) {
                if (token.isCancellationRequested) {
                    break;
                }
                const symbols = this.indexer.findSymbols(methodName, vscode.SymbolKind.Method);
                for (const symbol of symbols) {
                    const toItem = new vscode.CallHierarchyItem(vscode.SymbolKind.Method, symbol.name, symbol.containerName || '', symbol.location.uri, symbol.location.range, symbol.location.range);
                    // Find where in the current method this call occurs
                    const callRanges = await this.findMethodCalls(document, methodName, item.range);
                    outgoingCalls.push(new vscode.CallHierarchyOutgoingCall(toItem, callRanges.map(c => c.range)));
                }
            }
        }
        catch (error) {
            return undefined;
        }
        return outgoingCalls.length > 0 ? outgoingCalls : undefined;
    }
    async findMethodCalls(document, methodName, withinRange) {
        const calls = [];
        const text = withinRange ? document.getText(withinRange) : document.getText();
        const startOffset = withinRange ? document.offsetAt(withinRange.start) : 0;
        // Pattern to match method calls
        const patterns = [
            new RegExp(`\\.${methodName}\\b`, 'g'), // .method_name
            new RegExp(`\\b${methodName}\\s*\\(`, 'g'), // method_name(
            new RegExp(`\\b${methodName}\\s+\\w`, 'g'), // method_name arg
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const position = document.positionAt(startOffset + match.index);
                const line = document.lineAt(position.line);
                // Skip comments and strings
                if (line.text.trim().startsWith('#')) {
                    continue;
                }
                const range = new vscode.Range(position, document.positionAt(startOffset + match.index + match[0].length));
                calls.push({ range });
            }
        }
        return calls;
    }
    findContainingMethod(document, position) {
        // Get all methods in this file
        const fileSymbols = this.indexer.getFileSymbols(document.uri);
        const methods = fileSymbols.filter(s => s.kind === vscode.SymbolKind.Method || s.kind === vscode.SymbolKind.Function);
        // Find method that contains this position
        for (const method of methods) {
            if (method.location.range.contains(position)) {
                return {
                    name: method.name,
                    containerName: method.containerName,
                    range: method.location.range
                };
            }
        }
        return undefined;
    }
}
exports.RubyCallHierarchyProvider = RubyCallHierarchyProvider;
//# sourceMappingURL=callHierarchyProvider.js.map