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
exports.RubyReferenceProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Provides "Find All References" functionality like IDE Alt+F7
 * Shows all places where a class, method, constant, or variable is used
 */
class RubyReferenceProvider {
    constructor(indexer) {
        this.indexer = indexer;
    }
    async provideReferences(document, position, context, token) {
        if (token.isCancellationRequested) {
            return [];
        }
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return [];
        }
        const word = document.getText(wordRange);
        // Show progress for better UX
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Finding references to '${word}'...`,
            cancellable: true
        }, async (progress, progressToken) => {
            const references = [];
            // Perform RubyMate's comprehensive search
            let timedOut = false;
            // Add timeout: 2 minutes max for reference search
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    timedOut = true;
                    resolve(references); // Return partial results
                }, 120000); // 2 minutes
            });
            // Race between actual search and timeout
            return Promise.race([
                timeoutPromise,
                (async () => {
                    try {
                        // If context.includeDeclaration is true, include the definition
                        if (context.includeDeclaration) {
                            const definition = await this.findDefinition(word, document, position);
                            if (definition) {
                                references.push(definition);
                            }
                        }
                        // Search through all indexed files
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (!workspaceFolders) {
                            return references;
                        }
                        for (const folder of workspaceFolders) {
                            if (timedOut || token.isCancellationRequested || progressToken.isCancellationRequested) {
                                break;
                            }
                            const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*.rb'), '**/node_modules/**');
                            progress.report({
                                message: `Searching ${files.length} files...`,
                                increment: 0
                            });
                            const increment = 100 / files.length;
                            let processed = 0;
                            for (const fileUri of files) {
                                if (timedOut || token.isCancellationRequested || progressToken.isCancellationRequested) {
                                    break;
                                }
                                try {
                                    const fileDocument = await vscode.workspace.openTextDocument(fileUri);
                                    const locations = this.findWordOccurrences(fileDocument, word, context);
                                    references.push(...locations);
                                    processed++;
                                    if (processed % 10 === 0) {
                                        progress.report({
                                            increment: increment * 10,
                                            message: `Found ${references.length} references in ${processed}/${files.length} files`
                                        });
                                    }
                                }
                                catch (error) {
                                    // Skip files that can't be read
                                    continue;
                                }
                            }
                            if (timedOut) {
                                vscode.window.showWarningMessage(`Reference search timed out after 2 minutes. Showing ${references.length} partial results.`);
                            }
                            else {
                                progress.report({
                                    increment: 100,
                                    message: `Found ${references.length} references`
                                });
                            }
                        }
                        return references;
                    }
                    catch (error) {
                        // Log error but return partial results
                        console.error(`Error during reference search: ${error}`);
                        return references;
                    }
                })()
            ]);
        });
    }
    /**
     * Find the definition of the symbol (to include in references if requested)
     */
    async findDefinition(word, document, position) {
        // Check if current line is the definition
        const line = document.lineAt(position.line).text;
        // Method definition
        if (line.match(new RegExp(`def\\s+(self\\.)?${this.escapeRegex(word)}\\b`))) {
            return new vscode.Location(document.uri, position);
        }
        // Class definition
        if (line.match(new RegExp(`class\\s+${this.escapeRegex(word)}\\b`))) {
            return new vscode.Location(document.uri, position);
        }
        // Module definition
        if (line.match(new RegExp(`module\\s+${this.escapeRegex(word)}\\b`))) {
            return new vscode.Location(document.uri, position);
        }
        // Constant definition
        if (line.match(new RegExp(`${this.escapeRegex(word)}\\s*=`))) {
            return new vscode.Location(document.uri, position);
        }
        // Try to find from index
        const symbols = this.indexer.findSymbols(word);
        if (symbols.length > 0) {
            const exactMatch = symbols.find(s => s.name === word);
            return exactMatch ? exactMatch.location : symbols[0].location;
        }
        return undefined;
    }
    findWordOccurrences(document, word, context) {
        const locations = [];
        const text = document.getText();
        const escapedWord = this.escapeRegex(word);
        // Create regex patterns for different Ruby constructs
        const patterns = [
            // 1. Class/Module/Constant references (capitalized)
            new RegExp(`\\b${escapedWord}\\b`, 'g'),
            // 2. Method calls with dot notation: obj.method_name
            new RegExp(`\\.${escapedWord}\\b`, 'g'),
            // 3. Method calls with double colon: Module::method
            new RegExp(`::${escapedWord}\\b`, 'g'),
            // 4. Instance variables: @variable
            new RegExp(`@${escapedWord}\\b`, 'g'),
            // 5. Class variables: @@variable
            new RegExp(`@@${escapedWord}\\b`, 'g'),
            // 6. Symbols: :symbol
            new RegExp(`:${escapedWord}\\b`, 'g'),
            // 7. Dynamic sends: send(:method_name) or __send__(:method_name)
            new RegExp(`(?:send|__send__|public_send)\\s*\\(\\s*:${escapedWord}\\b`, 'g'),
            // 8. String sends: send("method_name")
            new RegExp(`(?:send|__send__|public_send)\\s*\\(\\s*["']${escapedWord}\\b`, 'g'),
            // 9. Delegate/alias: delegate :method, alias :new_name, :method
            new RegExp(`(?:delegate|alias|alias_method)\\s*:${escapedWord}\\b`, 'g'),
            // 10. Block parameters: do |method_name|
            new RegExp(`\\|[^|]*\\b${escapedWord}\\b[^|]*\\|`, 'g'),
            // 11. Hash keys (symbol): { method_name: value }
            new RegExp(`${escapedWord}:`, 'g'),
            // 12. Respond_to?: respond_to?(:method_name)
            new RegExp(`respond_to\\?\\s*\\(\\s*:${escapedWord}\\b`, 'g'),
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const position = document.positionAt(match.index);
                const line = document.lineAt(position.line);
                const lineText = line.text;
                // Skip comments (lines starting with # or inline comments)
                const commentIndex = lineText.indexOf('#');
                if (commentIndex !== -1 && position.character >= commentIndex) {
                    continue;
                }
                // Skip string literals (basic check - not perfect but helps)
                const beforeText = lineText.substring(0, position.character);
                const singleQuotes = (beforeText.match(/'/g) || []).length;
                const doubleQuotes = (beforeText.match(/"/g) || []).length;
                // If odd number of quotes before position, we're likely inside a string
                if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
                    // Unless it's a symbol or hash key, skip it
                    if (!match[0].startsWith(':') && !match[0].endsWith(':')) {
                        continue;
                    }
                }
                // Create location - highlight just the word, not the prefix
                let startOffset = match.index;
                let endOffset = match.index + match[0].length;
                // Adjust for prefixes like @, @@, :, .
                const matchText = match[0];
                if (matchText.startsWith('.') || matchText.startsWith(':') ||
                    matchText.startsWith('@') || matchText.startsWith('::')) {
                    startOffset += matchText.search(/\w/);
                }
                const range = new vscode.Range(document.positionAt(startOffset), document.positionAt(endOffset));
                // Avoid duplicate locations
                if (!locations.some(loc => loc.uri.toString() === document.uri.toString() &&
                    loc.range.isEqual(range))) {
                    locations.push(new vscode.Location(document.uri, range));
                }
            }
        }
        return locations;
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
exports.RubyReferenceProvider = RubyReferenceProvider;
//# sourceMappingURL=referenceProvider.js.map