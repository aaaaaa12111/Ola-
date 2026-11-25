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
exports.RubyHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Provides hover information like IDE Ctrl+Q (Quick Documentation)
 * Shows method signatures, parameter info, and documentation
 */
class RubyHoverProvider {
    constructor(indexer) {
        this.indexer = indexer;
    }
    async provideHover(document, position, token) {
        if (token.isCancellationRequested) {
            return undefined;
        }
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;
        // Build base hover from RubyMate index
        let baseHover = null;
        const symbols = this.indexer.findSymbols(word);
        if (symbols.length > 0) {
            // Prioritize by context
            const symbol = this.findBestMatch(symbols, word, line, document, position);
            if (symbol) {
                // Build hover content from RubyMate
                const hoverContent = this.buildHoverContent(symbol);
                baseHover = new vscode.Hover(hoverContent, wordRange);
            }
        }
        // Return hover (or undefined if no symbols found)
        return baseHover || undefined;
    }
    findBestMatch(symbols, word, line, document, position) {
        // Exact name match first
        const exactMatches = symbols.filter(s => s.name === word);
        if (exactMatches.length === 1) {
            return exactMatches[0];
        }
        // If multiple matches, try to determine from context
        if (exactMatches.length > 1) {
            // Check if it's a method call (has a dot before it)
            if (line.substring(0, position.character).match(/\.\s*\w+$/)) {
                const methodSymbols = exactMatches.filter(s => s.kind === vscode.SymbolKind.Method || s.kind === vscode.SymbolKind.Function);
                if (methodSymbols.length > 0) {
                    return methodSymbols[0];
                }
            }
            // Check if it's a class (capitalized)
            if (/^[A-Z]/.test(word)) {
                const classSymbols = exactMatches.filter(s => s.kind === vscode.SymbolKind.Class || s.kind === vscode.SymbolKind.Module);
                if (classSymbols.length > 0) {
                    return classSymbols[0];
                }
            }
            // Return first match as fallback
            return exactMatches[0];
        }
        return symbols[0];
    }
    buildHoverContent(symbol) {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        markdown.supportHtml = true;
        // Symbol kind icon
        const kindIcon = this.getKindIcon(symbol.kind);
        // Build signature
        let signature = '';
        switch (symbol.kind) {
            case vscode.SymbolKind.Class:
                signature = `class ${symbol.name}`;
                break;
            case vscode.SymbolKind.Module:
                signature = `module ${symbol.name}`;
                break;
            case vscode.SymbolKind.Method:
            case vscode.SymbolKind.Function:
                signature = this.buildMethodSignature(symbol);
                break;
            case vscode.SymbolKind.Constant:
                signature = `${symbol.name}`;
                break;
            default:
                signature = symbol.name;
        }
        // Add signature with syntax highlighting
        markdown.appendCodeblock(signature, 'ruby');
        // Add container info
        if (symbol.containerName) {
            markdown.appendMarkdown(`\n📦 Defined in: \`${symbol.containerName}\`\n`);
        }
        // Add file location
        const fileName = symbol.location.uri.fsPath.split('/').pop();
        const line = symbol.location.range.start.line + 1;
        markdown.appendMarkdown(`\n📄 ${fileName}:${line}\n`);
        // Add documentation if available
        if (symbol.documentation) {
            markdown.appendMarkdown(`\n---\n\n${symbol.documentation}\n`);
        }
        // Add parameter info for methods
        if (symbol.parameters && symbol.parameters.length > 0) {
            markdown.appendMarkdown('\n**Parameters:**\n');
            for (const param of symbol.parameters) {
                markdown.appendMarkdown(`- \`${param}\`\n`);
            }
        }
        // Add return type if available
        if (symbol.returnType) {
            markdown.appendMarkdown(`\n**Returns:** \`${symbol.returnType}\`\n`);
        }
        // Add usage count if tracked
        if (symbol.usageCount && symbol.usageCount > 0) {
            markdown.appendMarkdown(`\n💡 Used ${symbol.usageCount} time(s) in workspace\n`);
        }
        return markdown;
    }
    buildMethodSignature(symbol) {
        let signature = 'def ';
        // Add scope prefix if available
        if (symbol.scope === 'singleton' || symbol.scope === 'class') {
            signature += 'self.';
        }
        signature += symbol.name;
        // Add parameters
        if (symbol.parameters && symbol.parameters.length > 0) {
            signature += `(${symbol.parameters.join(', ')})`;
        }
        return signature;
    }
    getKindIcon(kind) {
        const icons = {
            [vscode.SymbolKind.Class]: '🏛️',
            [vscode.SymbolKind.Module]: '📦',
            [vscode.SymbolKind.Method]: '⚡',
            [vscode.SymbolKind.Function]: '⚙️',
            [vscode.SymbolKind.Constant]: '🔒',
            [vscode.SymbolKind.Variable]: '📝',
        };
        return icons[kind] || '📌';
    }
}
exports.RubyHoverProvider = RubyHoverProvider;
//# sourceMappingURL=hoverProvider.js.map