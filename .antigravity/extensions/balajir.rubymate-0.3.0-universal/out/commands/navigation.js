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
exports.NavigationCommands = void 0;
const vscode = __importStar(require("vscode"));
class NavigationCommands {
    constructor(symbolIndexer, outputChannel) {
        this.symbolIndexer = symbolIndexer;
        this.outputChannel = outputChannel;
    }
    registerCommands(context) {
        // Go to Class (Ctrl+N)
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.goToClass', () => this.goToClass()));
        // File Structure (Ctrl+F12)
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.fileStructure', () => this.showFileStructure()));
        // Search Everywhere (handled by VS Code's quickOpen, but we can enhance it)
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.searchEverywhere', () => this.searchEverywhere()));
        // Navigate to Related File (Rails-specific)
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.navigateToRelated', () => this.navigateToRelated()));
        // Quick Switch between source and test
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.toggleSpec', () => this.toggleSpec()));
    }
    async goToClass() {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Type class or module name...';
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        // Show loading
        quickPick.busy = true;
        quickPick.show();
        // Get all classes and modules
        const symbols = this.symbolIndexer.findClasses('');
        quickPick.items = symbols.map(symbol => ({
            label: `$(symbol-class) ${symbol.name}`,
            description: this.getSymbolPath(symbol),
            detail: symbol.detail,
            symbol
        }));
        quickPick.busy = false;
        // Handle search input
        quickPick.onDidChangeValue(value => {
            if (value) {
                const filtered = this.symbolIndexer.findClasses(value);
                quickPick.items = filtered.map(symbol => ({
                    label: `$(symbol-class) ${symbol.name}`,
                    description: this.getSymbolPath(symbol),
                    detail: symbol.detail,
                    symbol
                }));
            }
        });
        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            if (selected?.symbol) {
                this.navigateToSymbol(selected.symbol);
            }
            quickPick.dispose();
        });
        quickPick.onDidHide(() => quickPick.dispose());
    }
    async showFileStructure() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'ruby') {
            vscode.window.showInformationMessage('File structure is only available for Ruby files');
            return;
        }
        const symbols = this.symbolIndexer.getFileSymbols(editor.document.uri);
        if (symbols.length === 0) {
            vscode.window.showInformationMessage('No symbols found in current file');
            return;
        }
        const items = symbols.map(symbol => ({
            label: this.getSymbolIcon(symbol.kind) + ' ' + symbol.name,
            description: symbol.containerName,
            detail: symbol.detail,
            symbol
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a symbol to navigate to...',
            matchOnDescription: true
        });
        if (selected) {
            this.navigateToSymbol(selected.symbol);
        }
    }
    async searchEverywhere() {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Search for classes, methods, files...';
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        quickPick.show();
        quickPick.onDidChangeValue(async (value) => {
            if (!value) {
                quickPick.items = [];
                return;
            }
            quickPick.busy = true;
            // Search symbols
            const symbols = this.symbolIndexer.findSymbols(value);
            const symbolItems = symbols.slice(0, 20).map(symbol => ({
                label: this.getSymbolIcon(symbol.kind) + ' ' + symbol.name,
                description: this.getSymbolPath(symbol),
                detail: symbol.containerName || symbol.detail,
                symbol
            }));
            // Search files
            const files = await vscode.workspace.findFiles(`**/*${value}*.rb`, '**/node_modules/**', 10);
            const fileItems = files.map(uri => ({
                label: `$(file) ${this.getFileName(uri)}`,
                description: this.getRelativePath(uri),
                uri
            }));
            quickPick.items = [...symbolItems, ...fileItems];
            quickPick.busy = false;
        });
        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            if (selected) {
                if ('symbol' in selected && selected.symbol) {
                    this.navigateToSymbol(selected.symbol);
                }
                else if ('uri' in selected && selected.uri) {
                    vscode.window.showTextDocument(selected.uri);
                }
            }
            quickPick.dispose();
        });
        quickPick.onDidHide(() => quickPick.dispose());
    }
    async navigateToRelated() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const currentFile = editor.document.uri.fsPath;
        const relatedFiles = await this.findRelatedFiles(currentFile);
        if (relatedFiles.length === 0) {
            vscode.window.showInformationMessage('No related files found');
            return;
        }
        if (relatedFiles.length === 1) {
            // Directly open if only one related file
            const document = await vscode.workspace.openTextDocument(relatedFiles[0].uri);
            await vscode.window.showTextDocument(document);
            return;
        }
        // Show quick pick if multiple related files
        const selected = await vscode.window.showQuickPick(relatedFiles.map(f => ({
            label: f.label,
            description: f.description,
            uri: f.uri
        })), { placeHolder: 'Select related file...' });
        if (selected) {
            const document = await vscode.workspace.openTextDocument(selected.uri);
            await vscode.window.showTextDocument(document);
        }
    }
    async toggleSpec() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const currentFile = editor.document.uri.fsPath;
        let targetFile;
        if (currentFile.includes('_spec.rb')) {
            // Go from spec to implementation
            targetFile = currentFile
                .replace('/spec/', '/app/')
                .replace('/lib/', '/app/')
                .replace('_spec.rb', '.rb');
        }
        else if (currentFile.includes('_test.rb')) {
            // Go from minitest to implementation
            targetFile = currentFile
                .replace('/test/', '/app/')
                .replace('/lib/', '/app/')
                .replace('_test.rb', '.rb');
        }
        else if (currentFile.includes('/app/')) {
            // Go from implementation to spec
            // Try RSpec first
            targetFile = currentFile
                .replace('/app/', '/spec/')
                .replace('.rb', '_spec.rb');
            // Check if RSpec file exists, otherwise try Minitest
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(targetFile));
            }
            catch {
                targetFile = currentFile
                    .replace('/app/', '/test/')
                    .replace('.rb', '_test.rb');
            }
        }
        else if (currentFile.includes('/lib/')) {
            // Go from lib to spec
            targetFile = currentFile
                .replace('/lib/', '/spec/')
                .replace('.rb', '_spec.rb');
        }
        else {
            vscode.window.showInformationMessage('Not a Rails app or spec file');
            return;
        }
        try {
            const document = await vscode.workspace.openTextDocument(targetFile);
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            vscode.window.showWarningMessage(`File not found: ${targetFile}`);
        }
    }
    async findRelatedFiles(currentFile) {
        const related = [];
        // Rails patterns
        if (currentFile.includes('/app/models/')) {
            const modelName = this.getFileName(vscode.Uri.file(currentFile)).replace('.rb', '');
            // Find migration
            const migrations = await vscode.workspace.findFiles(`**/db/migrate/*_create_${this.pluralize(modelName)}.rb`);
            migrations.forEach(uri => {
                related.push({
                    label: '$(database) Migration',
                    description: this.getRelativePath(uri),
                    uri
                });
            });
            // Find spec
            const specPath = currentFile.replace('/app/', '/spec/').replace('.rb', '_spec.rb');
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(specPath));
                related.push({
                    label: '$(beaker) Spec',
                    description: this.getRelativePath(vscode.Uri.file(specPath)),
                    uri: vscode.Uri.file(specPath)
                });
            }
            catch { }
        }
        if (currentFile.includes('/app/controllers/')) {
            const controllerName = this.getFileName(vscode.Uri.file(currentFile))
                .replace('_controller.rb', '')
                .replace('_controller', '');
            // Find views
            const viewsPattern = `**/app/views/${controllerName}/**`;
            const views = await vscode.workspace.findFiles(viewsPattern);
            views.forEach(uri => {
                related.push({
                    label: `$(file-code) View: ${this.getFileName(uri)}`,
                    description: this.getRelativePath(uri),
                    uri
                });
            });
            // Find spec
            const specPath = currentFile.replace('/app/', '/spec/').replace('.rb', '_spec.rb');
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(specPath));
                related.push({
                    label: '$(beaker) Spec',
                    description: this.getRelativePath(vscode.Uri.file(specPath)),
                    uri: vscode.Uri.file(specPath)
                });
            }
            catch { }
        }
        if (currentFile.includes('_spec.rb') || currentFile.includes('_test.rb')) {
            // Find implementation
            let implPath = currentFile.replace('/spec/', '/app/').replace('_spec.rb', '.rb');
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(implPath));
                related.push({
                    label: '$(ruby) Implementation',
                    description: this.getRelativePath(vscode.Uri.file(implPath)),
                    uri: vscode.Uri.file(implPath)
                });
            }
            catch {
                // Try lib
                implPath = currentFile.replace('/spec/', '/lib/').replace('_spec.rb', '.rb');
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(implPath));
                    related.push({
                        label: '$(ruby) Implementation',
                        description: this.getRelativePath(vscode.Uri.file(implPath)),
                        uri: vscode.Uri.file(implPath)
                    });
                }
                catch { }
            }
        }
        return related;
    }
    navigateToSymbol(symbol) {
        vscode.window.showTextDocument(symbol.location.uri, {
            selection: symbol.location.range
        });
    }
    getSymbolIcon(kind) {
        switch (kind) {
            case vscode.SymbolKind.Class: return '$(symbol-class)';
            case vscode.SymbolKind.Module: return '$(symbol-namespace)';
            case vscode.SymbolKind.Method: return '$(symbol-method)';
            case vscode.SymbolKind.Constant: return '$(symbol-constant)';
            case vscode.SymbolKind.Property: return '$(symbol-property)';
            default: return '$(symbol-misc)';
        }
    }
    getSymbolPath(symbol) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return symbol.location.uri.fsPath;
        }
        const relativePath = vscode.workspace.asRelativePath(symbol.location.uri, false);
        return relativePath;
    }
    getFileName(uri) {
        const parts = uri.fsPath.split('/');
        return parts[parts.length - 1];
    }
    getRelativePath(uri) {
        return vscode.workspace.asRelativePath(uri, false);
    }
    pluralize(word) {
        // Simple pluralization - in production, use a library
        if (word.endsWith('y')) {
            return word.slice(0, -1) + 'ies';
        }
        if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
            return word + 'es';
        }
        return word + 's';
    }
}
exports.NavigationCommands = NavigationCommands;
//# sourceMappingURL=navigation.js.map