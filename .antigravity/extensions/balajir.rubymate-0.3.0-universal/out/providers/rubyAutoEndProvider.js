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
exports.RubyAutoEndOnEnterProvider = exports.RubyAutoEndProvider = void 0;
const vscode = __importStar(require("vscode"));
class RubyAutoEndProvider {
    constructor() {
        // Keywords that require 'end' in Ruby
        this.blockKeywords = [
            'def', 'class', 'module', 'if', 'unless', 'case', 'while', 'until',
            'for', 'begin', 'do'
        ];
    }
    provideCompletionItems(document, position, token, context) {
        const lineText = document.lineAt(position).text;
        const textBeforeCursor = lineText.substring(0, position.character);
        // Check if we just typed a block keyword
        const match = textBeforeCursor.match(/\b(def|class|module|if|unless|case|while|until|for|begin)\s+(.*)$/);
        if (!match) {
            return [];
        }
        const keyword = match[1];
        const afterKeyword = match[2];
        // Don't auto-complete for incomplete statements
        // e.g., "def" without method name, or "class" without class name
        if (this.shouldSkipAutoEnd(keyword, afterKeyword)) {
            return [];
        }
        // Create completion item that adds 'end'
        const completionItem = new vscode.CompletionItem('Auto-add end', vscode.CompletionItemKind.Snippet);
        completionItem.detail = 'Automatically close Ruby block';
        // Insert newline, indent, cursor position, newline, and 'end'
        const indent = this.getIndentation(lineText);
        const snippetString = new vscode.SnippetString();
        snippetString.appendText('\n');
        snippetString.appendText(indent + '  '); // Add extra indent for body
        snippetString.appendTabstop(0); // Cursor position
        snippetString.appendText('\n');
        snippetString.appendText(indent + 'end');
        completionItem.insertText = snippetString;
        completionItem.sortText = '0'; // Show at top of completion list
        completionItem.preselect = true;
        return [completionItem];
    }
    shouldSkipAutoEnd(keyword, afterKeyword) {
        const trimmed = afterKeyword.trim();
        // Skip if nothing after keyword
        if (!trimmed) {
            return true;
        }
        // Skip for single-line conditionals (modifier if/unless)
        if ((keyword === 'if' || keyword === 'unless') && trimmed.split(/\s+/).length < 2) {
            return true;
        }
        // Skip if line already contains 'end'
        if (trimmed.includes('end')) {
            return true;
        }
        return false;
    }
    getIndentation(lineText) {
        const match = lineText.match(/^(\s*)/);
        return match ? match[1] : '';
    }
}
exports.RubyAutoEndProvider = RubyAutoEndProvider;
/**
 * Provider that automatically inserts 'end' when Enter is pressed after block keywords
 */
class RubyAutoEndOnEnterProvider {
    constructor() {
        this.blockKeywords = [
            'def', 'class', 'module', 'if', 'unless', 'case', 'when', 'while',
            'until', 'for', 'begin', 'do'
        ];
    }
    async provideOnEnter(document, position) {
        const config = vscode.workspace.getConfiguration('rubymate');
        const autoEnd = config.get('autoInsertEnd', true);
        if (!autoEnd) {
            return null;
        }
        const currentLine = document.lineAt(position.line);
        const lineText = currentLine.text;
        const trimmedLine = lineText.trim();
        // Check if current line starts with a block keyword
        const keywordMatch = trimmedLine.match(/^(def|class|module|if|unless|case|when|while|until|for|begin|do)\b/);
        if (!keywordMatch) {
            return null;
        }
        const keyword = keywordMatch[1];
        // Skip for certain patterns
        if (this.shouldSkipAutoEnd(keyword, trimmedLine, document, position)) {
            return null;
        }
        // Check if 'end' already exists in the scope
        if (this.hasMatchingEnd(document, position.line)) {
            return null;
        }
        // Calculate indentation
        const indent = this.getIndentation(lineText);
        const bodyIndent = indent + '  ';
        // Create edits to insert cursor position and 'end'
        const edits = [];
        // Insert a blank line for the body and the 'end' keyword
        const endLinePosition = new vscode.Position(position.line + 1, 0);
        edits.push(vscode.TextEdit.insert(endLinePosition, `${bodyIndent}\n${indent}end\n`));
        return edits;
    }
    shouldSkipAutoEnd(keyword, lineText, document, position) {
        // Skip if line already contains 'end' or is a single-line statement
        if (lineText.includes(' end') || lineText.endsWith('end')) {
            return true;
        }
        // Skip for modifier if/unless (e.g., "return if condition")
        if ((keyword === 'if' || keyword === 'unless') && !lineText.startsWith(keyword)) {
            return true;
        }
        // Skip for 'do' that's part of a single-line block (e.g., "array.each do |item| puts item end")
        if (keyword === 'do' && lineText.includes('|') && lineText.split('|').length > 2) {
            return true;
        }
        // Skip for 'when' inside a case statement (only case needs end, not when)
        if (keyword === 'when') {
            return true;
        }
        return false;
    }
    hasMatchingEnd(document, startLine) {
        let blockCount = 1;
        const maxLines = Math.min(startLine + 50, document.lineCount); // Look ahead max 50 lines
        for (let i = startLine + 1; i < maxLines; i++) {
            const line = document.lineAt(i).text.trim();
            // Count nested blocks
            if (line.match(/^(def|class|module|if|unless|case|while|until|for|begin|do)\b/)) {
                blockCount++;
            }
            // Count ends
            if (line.match(/^end\b/) || line.match(/\bend$/)) {
                blockCount--;
                if (blockCount === 0) {
                    return true;
                }
            }
        }
        return false;
    }
    getIndentation(lineText) {
        const match = lineText.match(/^(\s*)/);
        return match ? match[1] : '';
    }
}
exports.RubyAutoEndOnEnterProvider = RubyAutoEndOnEnterProvider;
//# sourceMappingURL=rubyAutoEndProvider.js.map