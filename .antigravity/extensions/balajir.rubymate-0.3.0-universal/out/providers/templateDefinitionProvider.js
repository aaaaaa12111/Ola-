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
exports.TemplateHoverProvider = exports.TemplateDefinitionProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Template Definition Provider
 * Provides "Go to Definition" for partials in Rails templates
 *
 * Examples:
 * - render 'users/form' → app/views/users/_form.html.erb
 * - render partial: 'shared/header' → app/views/shared/_header.html.erb
 * - <%= render @user %> → app/views/users/_user.html.erb
 */
class TemplateDefinitionProvider {
    async provideDefinition(document, position, token) {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        // Check if we're on a render statement
        const partialPath = this.extractPartialPath(lineText, position.character);
        if (!partialPath) {
            return undefined;
        }
        // Find the partial file
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return undefined;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const partialLocations = await this.findPartialFile(workspaceRoot, partialPath, document.uri.fsPath);
        if (partialLocations.length > 0) {
            return partialLocations;
        }
        return undefined;
    }
    /**
     * Extract partial path from render statement
     */
    extractPartialPath(lineText, characterPos) {
        // Pattern 1: render 'partial_name'
        const simpleRenderMatch = lineText.match(/render\s+['"]([^'"]+)['"]/);
        if (simpleRenderMatch) {
            const partialName = simpleRenderMatch[1];
            const matchStart = lineText.indexOf(partialName);
            const matchEnd = matchStart + partialName.length;
            if (characterPos >= matchStart && characterPos <= matchEnd) {
                return partialName;
            }
        }
        // Pattern 2: render partial: 'partial_name'
        const partialKeywordMatch = lineText.match(/render\s+partial:\s*['"]([^'"]+)['"]/);
        if (partialKeywordMatch) {
            const partialName = partialKeywordMatch[1];
            const matchStart = lineText.indexOf(partialName, lineText.indexOf('partial:'));
            const matchEnd = matchStart + partialName.length;
            if (characterPos >= matchStart && characterPos <= matchEnd) {
                return partialName;
            }
        }
        // Pattern 3: render template: 'template_name'
        const templateMatch = lineText.match(/render\s+template:\s*['"]([^'"]+)['"]/);
        if (templateMatch) {
            const templateName = templateMatch[1];
            const matchStart = lineText.indexOf(templateName, lineText.indexOf('template:'));
            const matchEnd = matchStart + templateName.length;
            if (characterPos >= matchStart && characterPos <= matchEnd) {
                return templateName;
            }
        }
        // Pattern 4: render layout: 'layout_name'
        const layoutMatch = lineText.match(/render\s+layout:\s*['"]([^'"]+)['"]/);
        if (layoutMatch) {
            const layoutName = layoutMatch[1];
            const matchStart = lineText.indexOf(layoutName, lineText.indexOf('layout:'));
            const matchEnd = matchStart + layoutName.length;
            if (characterPos >= matchStart && characterPos <= matchEnd) {
                return layoutName;
            }
        }
        return null;
    }
    /**
     * Find partial file in workspace
     */
    async findPartialFile(workspaceRoot, partialPath, currentFilePath) {
        const locations = [];
        // Determine if this is a full path or relative to current directory
        const isFullPath = partialPath.includes('/');
        // Get extensions to try
        const extensions = ['.html.erb', '.html.haml', '.html.slim', '.erb', '.haml', '.slim'];
        if (isFullPath) {
            // Full path: 'users/form' or 'shared/header'
            const parts = partialPath.split('/');
            const fileName = parts.pop();
            const dirPath = parts.join('/');
            // Try finding in app/views/<dirPath>/_<fileName>.<ext>
            for (const ext of extensions) {
                const partialFileName = `_${fileName}${ext}`;
                const fullPath = path.join(workspaceRoot, 'app', 'views', dirPath, partialFileName);
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
                    locations.push(new vscode.Location(vscode.Uri.file(fullPath), new vscode.Position(0, 0)));
                }
                catch {
                    // File doesn't exist, continue
                }
            }
        }
        else {
            // Relative path: 'form' or 'header'
            // Try to find in the same directory as current file
            const currentDir = path.dirname(currentFilePath);
            for (const ext of extensions) {
                const partialFileName = `_${partialPath}${ext}`;
                const fullPath = path.join(currentDir, partialFileName);
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
                    locations.push(new vscode.Location(vscode.Uri.file(fullPath), new vscode.Position(0, 0)));
                }
                catch {
                    // File doesn't exist, continue
                }
            }
            // If not found in current directory, try app/views/shared
            if (locations.length === 0) {
                for (const ext of extensions) {
                    const partialFileName = `_${partialPath}${ext}`;
                    const fullPath = path.join(workspaceRoot, 'app', 'views', 'shared', partialFileName);
                    try {
                        await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
                        locations.push(new vscode.Location(vscode.Uri.file(fullPath), new vscode.Position(0, 0)));
                    }
                    catch {
                        // File doesn't exist, continue
                    }
                }
            }
        }
        // If still not found, try fuzzy search across all views
        if (locations.length === 0) {
            const fuzzyLocations = await this.fuzzyFindPartial(workspaceRoot, partialPath);
            locations.push(...fuzzyLocations);
        }
        return locations;
    }
    /**
     * Fuzzy search for partial across all views
     */
    async fuzzyFindPartial(workspaceRoot, partialPath) {
        const locations = [];
        const viewsDir = path.join(workspaceRoot, 'app', 'views');
        try {
            // Use glob pattern to find all partials matching the name
            const fileName = partialPath.split('/').pop() || partialPath;
            const pattern = new vscode.RelativePattern(viewsDir, `**/_${fileName}.*`);
            const files = await vscode.workspace.findFiles(pattern, null, 10);
            for (const file of files) {
                locations.push(new vscode.Location(file, new vscode.Position(0, 0)));
            }
        }
        catch (error) {
            // Directory doesn't exist or other error
        }
        return locations;
    }
}
exports.TemplateDefinitionProvider = TemplateDefinitionProvider;
/**
 * Template Hover Provider
 * Provides hover information for Rails helpers and partials
 */
class TemplateHoverProvider {
    async provideHover(document, position, token) {
        const line = document.lineAt(position.line);
        const lineText = line.text;
        // Check for render statements
        const renderMatch = lineText.match(/render\s+(?:partial:\s*)?['"]([^'"]+)['"]/);
        if (renderMatch) {
            const partialName = renderMatch[1];
            const matchStart = lineText.indexOf(partialName);
            const matchEnd = matchStart + partialName.length;
            if (position.character >= matchStart && position.character <= matchEnd) {
                const markdown = new vscode.MarkdownString();
                markdown.appendMarkdown(`**Rails Partial**\n\n`);
                markdown.appendCodeblock(`render '${partialName}'`, 'ruby');
                markdown.appendMarkdown(`\nLooking for: \`_${partialName}.html.erb\``);
                return new vscode.Hover(markdown);
            }
        }
        return undefined;
    }
}
exports.TemplateHoverProvider = TemplateHoverProvider;
//# sourceMappingURL=templateDefinitionProvider.js.map