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
exports.RubyDefinitionProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Comprehensive definition provider that handles:
 * 1. Class and module navigation
 * 2. Method navigation
 * 3. Require statement navigation
 * 4. Constant navigation
 */
class RubyDefinitionProvider {
    constructor(indexer) {
        this.indexer = indexer;
    }
    async provideDefinition(document, position, token) {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        // Get the word at cursor position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            // Check for require statements even without word
            return this.handleRequireStatement(document, position, lineText);
        }
        const word = document.getText(wordRange);
        // Use RubyMate index-based definition finding
        // 1. Try require statement first (handles paths in quotes)
        const requireDef = await this.handleRequireStatement(document, position, lineText);
        if (requireDef) {
            return requireDef;
        }
        // 2. Try class/module navigation
        const classDef = await this.findClassDefinition(word);
        if (classDef) {
            return classDef;
        }
        // 3. Try method navigation (including method calls)
        const methodDef = await this.findMethodDefinition(word, document, position);
        if (methodDef) {
            return methodDef;
        }
        // 4. Try constant navigation
        const constantDef = await this.findConstantDefinition(word);
        if (constantDef) {
            return constantDef;
        }
        return undefined;
    }
    /**
     * Handle require/require_relative/autoload statements
     */
    async handleRequireStatement(document, position, lineText) {
        // require "test_helper"
        const requireMatch = lineText.match(/require\s+["']([^"']+)["']/);
        if (requireMatch) {
            const requiredPath = requireMatch[1];
            const requireStart = lineText.indexOf(requiredPath);
            const requireEnd = requireStart + requiredPath.length;
            if (position.character >= requireStart && position.character <= requireEnd) {
                return await this.resolveRequirePath(requiredPath, document.uri);
            }
        }
        // require_relative "../models/user"
        const requireRelativeMatch = lineText.match(/require_relative\s+["']([^"']+)["']/);
        if (requireRelativeMatch) {
            const relativePath = requireRelativeMatch[1];
            const requireStart = lineText.indexOf(relativePath);
            const requireEnd = requireStart + relativePath.length;
            if (position.character >= requireStart && position.character <= requireEnd) {
                const currentDir = path.dirname(document.uri.fsPath);
                let targetPath = path.join(currentDir, relativePath);
                if (!targetPath.endsWith('.rb')) {
                    targetPath += '.rb';
                }
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
                    return new vscode.Location(vscode.Uri.file(targetPath), new vscode.Position(0, 0));
                }
                catch {
                    return undefined;
                }
            }
        }
        // autoload :MyClass, 'lib/my_class'
        const autoloadMatch = lineText.match(/autoload\s+:\w+,\s+["']([^"']+)["']/);
        if (autoloadMatch) {
            const filePath = autoloadMatch[1];
            const pathStart = lineText.indexOf(filePath);
            const pathEnd = pathStart + filePath.length;
            if (position.character >= pathStart && position.character <= pathEnd) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                if (workspaceFolder) {
                    let targetPath = path.join(workspaceFolder.uri.fsPath, filePath);
                    if (!targetPath.endsWith('.rb')) {
                        targetPath += '.rb';
                    }
                    try {
                        await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
                        return new vscode.Location(vscode.Uri.file(targetPath), new vscode.Position(0, 0));
                    }
                    catch {
                        return undefined;
                    }
                }
            }
        }
        return undefined;
    }
    /**
     * Find class or module definition
     * Shows popup if multiple results found (like IDE)
     */
    async findClassDefinition(word) {
        // Search for exact class match
        const symbols = this.indexer.findClasses(word);
        const exactMatches = symbols.filter(s => s.name === word);
        // Also search in modules
        const moduleSymbols = this.indexer.findSymbols(word, vscode.SymbolKind.Module);
        const exactModules = moduleSymbols.filter(s => s.name === word);
        // Combine all exact matches
        const allMatches = [...exactMatches, ...exactModules];
        if (allMatches.length === 0) {
            // No exact matches, try fuzzy
            if (symbols.length > 0) {
                return symbols[0].location;
            }
            if (moduleSymbols.length > 0) {
                return moduleSymbols[0].location;
            }
            return undefined;
        }
        if (allMatches.length === 1) {
            // Single match - navigate directly
            return allMatches[0].location;
        }
        // Multiple matches - return all (VS Code will show QuickPick automatically)
        return allMatches.map(s => s.location);
    }
    /**
     * Find method definition
     * Shows popup if multiple results found (like IDE)
     */
    async findMethodDefinition(methodName, document, position) {
        // Get context - try to find the class this method belongs to
        const className = this.findClassContext(document, position);
        // Search for method in the class
        if (className) {
            const methods = this.indexer.findMethodsInClass(className);
            const method = methods.find(m => m.name === methodName);
            if (method) {
                return method.location;
            }
        }
        // Fallback: search for method globally
        const symbols = this.indexer.findSymbols(methodName, vscode.SymbolKind.Method);
        const exactMatches = symbols.filter(s => s.name === methodName);
        if (exactMatches.length === 0) {
            // No exact matches, try first fuzzy
            return symbols.length > 0 ? symbols[0].location : undefined;
        }
        if (exactMatches.length === 1) {
            // Single match - navigate directly
            return exactMatches[0].location;
        }
        // Multiple matches - return all (VS Code will show QuickPick automatically)
        return exactMatches.map(s => s.location);
    }
    /**
     * Find constant definition
     */
    async findConstantDefinition(word) {
        const symbols = this.indexer.findSymbols(word, vscode.SymbolKind.Constant);
        if (symbols.length > 0) {
            const exactMatch = symbols.find(s => s.name === word);
            if (exactMatch) {
                return exactMatch.location;
            }
            return symbols[0].location;
        }
        return undefined;
    }
    /**
     * Find the class context from the current position
     */
    findClassContext(document, position) {
        // Search upwards for class definition
        for (let i = position.line; i >= 0; i--) {
            const line = document.lineAt(i).text;
            const classMatch = line.match(/^\s*class\s+(\w+)/);
            if (classMatch) {
                return classMatch[1];
            }
            const moduleMatch = line.match(/^\s*module\s+(\w+)/);
            if (moduleMatch) {
                return moduleMatch[1];
            }
        }
        return undefined;
    }
    /**
     * Resolve require path (same as before)
     */
    async resolveRequirePath(requiredPath, currentFileUri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri);
        if (!workspaceFolder) {
            return undefined;
        }
        const workspaceRoot = workspaceFolder.uri.fsPath;
        const currentFilePath = currentFileUri.fsPath;
        const pathsToTry = [];
        // Rails-specific patterns
        if (requiredPath === 'test_helper') {
            pathsToTry.push(path.join(workspaceRoot, 'test', 'test_helper.rb'));
        }
        if (requiredPath === 'spec_helper' || requiredPath === 'rails_helper') {
            pathsToTry.push(path.join(workspaceRoot, 'spec', `${requiredPath}.rb`));
        }
        if (requiredPath === 'application_helper') {
            pathsToTry.push(path.join(workspaceRoot, 'app', 'helpers', 'application_helper.rb'));
        }
        // App directories
        const appDirs = ['models', 'controllers', 'helpers', 'services', 'jobs', 'mailers', 'channels'];
        for (const dir of appDirs) {
            pathsToTry.push(path.join(workspaceRoot, 'app', dir, `${requiredPath}.rb`));
        }
        // Relative to current file
        const currentDir = path.dirname(currentFilePath);
        pathsToTry.push(path.join(currentDir, `${requiredPath}.rb`));
        pathsToTry.push(path.join(currentDir, requiredPath));
        // Workspace root
        pathsToTry.push(path.join(workspaceRoot, `${requiredPath}.rb`));
        pathsToTry.push(path.join(workspaceRoot, requiredPath));
        // Lib directory
        pathsToTry.push(path.join(workspaceRoot, 'lib', `${requiredPath}.rb`));
        // Test/spec support
        pathsToTry.push(path.join(workspaceRoot, 'test', 'support', `${requiredPath}.rb`));
        pathsToTry.push(path.join(workspaceRoot, 'spec', 'support', `${requiredPath}.rb`));
        // Handle paths with slashes
        if (requiredPath.includes('/')) {
            pathsToTry.push(path.join(workspaceRoot, 'test', `${requiredPath}.rb`));
            pathsToTry.push(path.join(workspaceRoot, 'spec', `${requiredPath}.rb`));
            pathsToTry.push(path.join(workspaceRoot, 'app', `${requiredPath}.rb`));
        }
        // Try each path
        for (const tryPath of pathsToTry) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(tryPath));
                return new vscode.Location(vscode.Uri.file(tryPath), new vscode.Position(0, 0));
            }
            catch {
                // File doesn't exist, try next
            }
        }
        // Fallback: glob search
        const fileName = path.basename(requiredPath);
        const pattern = `**/${fileName}.rb`;
        try {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
            if (files.length > 0) {
                return new vscode.Location(files[0], new vscode.Position(0, 0));
            }
        }
        catch {
            // Search failed
        }
        return undefined;
    }
}
exports.RubyDefinitionProvider = RubyDefinitionProvider;
//# sourceMappingURL=rubyDefinitionProvider.js.map