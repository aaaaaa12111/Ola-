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
exports.RubyAutoloadProvider = exports.RubyRequireRelativeProvider = exports.RubyDefinitionProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class RubyDefinitionProvider {
    async provideDefinition(document, position, token) {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        // Check if this is a require statement
        const requireMatch = lineText.match(/require\s+["']([^"']+)["']/);
        if (!requireMatch) {
            return undefined;
        }
        const requiredPath = requireMatch[1];
        const cursorOffset = position.character;
        const requireStart = lineText.indexOf(requiredPath);
        const requireEnd = requireStart + requiredPath.length;
        // Check if cursor is on the required path
        if (cursorOffset < requireStart || cursorOffset > requireEnd) {
            return undefined;
        }
        // Try to resolve the require path
        const targetPath = await this.resolveRequirePath(requiredPath, document.uri);
        if (targetPath) {
            return new vscode.Location(targetPath, new vscode.Position(0, 0));
        }
        return undefined;
    }
    async resolveRequirePath(requiredPath, currentFileUri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentFileUri);
        if (!workspaceFolder) {
            return undefined;
        }
        const workspaceRoot = workspaceFolder.uri.fsPath;
        const currentFilePath = currentFileUri.fsPath;
        // List of paths to try, in order of priority
        const pathsToTry = [];
        // 1. Rails-specific patterns
        if (this.isRailsProject(workspaceRoot)) {
            // Test helper in test directory
            if (requiredPath === 'test_helper') {
                pathsToTry.push(path.join(workspaceRoot, 'test', 'test_helper.rb'));
            }
            // Spec helper in spec directory
            if (requiredPath === 'spec_helper' || requiredPath === 'rails_helper') {
                pathsToTry.push(path.join(workspaceRoot, 'spec', `${requiredPath}.rb`));
            }
            // Application helper
            if (requiredPath === 'application_helper') {
                pathsToTry.push(path.join(workspaceRoot, 'app', 'helpers', 'application_helper.rb'));
            }
            // Models, controllers, helpers
            const railsPaths = [
                ['models', 'app/models'],
                ['controllers', 'app/controllers'],
                ['helpers', 'app/helpers'],
                ['services', 'app/services'],
                ['jobs', 'app/jobs'],
                ['mailers', 'app/mailers'],
                ['channels', 'app/channels']
            ];
            for (const [, dirPath] of railsPaths) {
                pathsToTry.push(path.join(workspaceRoot, dirPath, `${requiredPath}.rb`));
            }
        }
        // 2. Relative path from current file
        const currentDir = path.dirname(currentFilePath);
        pathsToTry.push(path.join(currentDir, `${requiredPath}.rb`));
        pathsToTry.push(path.join(currentDir, requiredPath)); // Already has .rb
        // 3. Relative to workspace root
        pathsToTry.push(path.join(workspaceRoot, `${requiredPath}.rb`));
        pathsToTry.push(path.join(workspaceRoot, requiredPath));
        // 4. In lib directory
        pathsToTry.push(path.join(workspaceRoot, 'lib', `${requiredPath}.rb`));
        pathsToTry.push(path.join(workspaceRoot, 'lib', requiredPath));
        // 5. In test/support directory
        pathsToTry.push(path.join(workspaceRoot, 'test', 'support', `${requiredPath}.rb`));
        pathsToTry.push(path.join(workspaceRoot, 'spec', 'support', `${requiredPath}.rb`));
        // 6. Handle paths with slashes (e.g., "support/some_helper")
        if (requiredPath.includes('/')) {
            pathsToTry.push(path.join(workspaceRoot, 'test', `${requiredPath}.rb`));
            pathsToTry.push(path.join(workspaceRoot, 'spec', `${requiredPath}.rb`));
            pathsToTry.push(path.join(workspaceRoot, 'app', `${requiredPath}.rb`));
        }
        // Try each path
        for (const tryPath of pathsToTry) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(tryPath));
                return vscode.Uri.file(tryPath);
            }
            catch {
                // File doesn't exist, try next
            }
        }
        // If still not found, try glob search as last resort
        const fileName = path.basename(requiredPath);
        const pattern = `**/${fileName}.rb`;
        try {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
            if (files.length > 0) {
                return files[0];
            }
        }
        catch {
            // Search failed
        }
        return undefined;
    }
    isRailsProject(workspaceRoot) {
        // Check for Rails indicators
        try {
            const indicators = [
                path.join(workspaceRoot, 'config', 'application.rb'),
                path.join(workspaceRoot, 'Gemfile')
            ];
            // We can't use sync fs operations, so we'll assume it's a Rails project
            // if the workspace contains typical Rails directories
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.RubyDefinitionProvider = RubyDefinitionProvider;
/**
 * Extended definition provider that handles require_relative as well
 */
class RubyRequireRelativeProvider {
    async provideDefinition(document, position, token) {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        // Check if this is a require_relative statement
        const requireMatch = lineText.match(/require_relative\s+["']([^"']+)["']/);
        if (!requireMatch) {
            return undefined;
        }
        const relativePath = requireMatch[1];
        const cursorOffset = position.character;
        const requireStart = lineText.indexOf(relativePath);
        const requireEnd = requireStart + relativePath.length;
        // Check if cursor is on the required path
        if (cursorOffset < requireStart || cursorOffset > requireEnd) {
            return undefined;
        }
        // Resolve relative path from current file
        const currentDir = path.dirname(document.uri.fsPath);
        let targetPath = path.join(currentDir, relativePath);
        // Add .rb extension if not present
        if (!targetPath.endsWith('.rb')) {
            targetPath += '.rb';
        }
        // Check if file exists
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
            return new vscode.Location(vscode.Uri.file(targetPath), new vscode.Position(0, 0));
        }
        catch {
            return undefined;
        }
    }
}
exports.RubyRequireRelativeProvider = RubyRequireRelativeProvider;
/**
 * Provider for autoload statements
 */
class RubyAutoloadProvider {
    async provideDefinition(document, position, token) {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        // Check if this is an autoload statement
        // autoload :SomeClass, 'path/to/file'
        const autoloadMatch = lineText.match(/autoload\s+:(\w+),\s+["']([^"']+)["']/);
        if (!autoloadMatch) {
            return undefined;
        }
        const filePath = autoloadMatch[2];
        const cursorOffset = position.character;
        const pathStart = lineText.indexOf(filePath);
        const pathEnd = pathStart + filePath.length;
        // Check if cursor is on the file path
        if (cursorOffset < pathStart || cursorOffset > pathEnd) {
            return undefined;
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }
        // Try to resolve path
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
exports.RubyAutoloadProvider = RubyAutoloadProvider;
//# sourceMappingURL=definitionProvider.js.map