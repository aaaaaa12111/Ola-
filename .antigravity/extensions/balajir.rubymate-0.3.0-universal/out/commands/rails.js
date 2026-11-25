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
exports.RailsCommands = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const shellEscape_1 = require("../utils/shellEscape");
class RailsCommands {
    constructor(outputChannel) {
        this.routesCache = null;
        this.schemaCache = null;
        this.outputChannel = outputChannel;
    }
    registerCommands(context) {
        // Navigate to related Rails files
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.navigateToModel', () => this.navigateToModel()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.navigateToController', () => this.navigateToController()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.navigateToView', () => this.navigateToView()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.navigateToMigration', () => this.navigateToMigration()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.navigateToSpec', () => this.navigateToSpec()));
        // Route navigation
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.showRoutes', () => this.showRoutes()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.goToRoute', () => this.goToRoute()));
        // Generator commands
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.generateModel', () => this.generateModel()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.generateController', () => this.generateController()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.generateMigration', () => this.generateMigration()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.generateScaffold', () => this.generateScaffold()));
        // Rails console
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.openConsole', () => this.openConsole()));
        // Schema navigation
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.showSchema', () => this.showSchema()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.goToTableDefinition', () => this.goToTableDefinition()));
        // Migration helpers
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.runMigrations', () => this.runMigrations()));
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.rollbackMigration', () => this.rollbackMigration()));
        // Concerns navigation
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.rails.goToConcern', () => this.goToConcern()));
    }
    async navigateToModel() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const currentFile = editor.document.uri.fsPath;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        let modelName;
        let namespace = '';
        // Extract model name and namespace based on current file type
        if (currentFile.includes('/controllers/')) {
            const { namespace: ns, basename } = this.extractNamespace(currentFile);
            namespace = ns;
            modelName = this.singularize(basename);
        }
        else if (currentFile.includes('/views/')) {
            const parts = currentFile.split('/views/');
            if (parts[1]) {
                const viewPath = parts[1];
                const pathParts = viewPath.split('/');
                // Handle namespaced views (e.g., admin/users/index.html.erb)
                if (pathParts.length > 2) {
                    namespace = pathParts.slice(0, -2).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('::');
                    modelName = this.singularize(pathParts[pathParts.length - 2]);
                }
                else {
                    modelName = this.singularize(pathParts[0]);
                }
            }
        }
        if (!modelName) {
            modelName = await vscode.window.showInputBox({
                prompt: 'Enter model name (e.g., User or Admin::User)',
                placeHolder: 'User'
            });
        }
        if (!modelName)
            return;
        // Handle fully qualified names (Admin::User)
        if (modelName.includes('::')) {
            const parts = modelName.split('::');
            namespace = parts.slice(0, -1).join('::');
            modelName = parts[parts.length - 1];
        }
        // Try multiple strategies to find the model
        let foundPath = null;
        // Strategy 1: Exact path with namespace
        if (namespace) {
            const namespacePath = namespace.toLowerCase().replace(/::/g, '/');
            const exactPath = path.join(workspaceFolder.uri.fsPath, 'app', 'models', namespacePath, `${modelName.toLowerCase()}.rb`);
            if (fs.existsSync(exactPath)) {
                foundPath = exactPath;
            }
        }
        // Strategy 2: Direct path without namespace
        if (!foundPath) {
            const directPath = path.join(workspaceFolder.uri.fsPath, 'app', 'models', `${modelName.toLowerCase()}.rb`);
            if (fs.existsSync(directPath)) {
                foundPath = directPath;
            }
        }
        // Strategy 3: Fuzzy search across all models
        if (!foundPath) {
            const modelFiles = await this.findFilesFuzzy(workspaceFolder, `app/models/**/${modelName.toLowerCase()}.rb`);
            if (modelFiles.length > 0) {
                if (modelFiles.length === 1) {
                    foundPath = modelFiles[0].fsPath;
                }
                else {
                    // Multiple matches - let user choose
                    const choices = modelFiles.map(file => ({
                        label: path.relative(workspaceFolder.uri.fsPath, file.fsPath),
                        path: file.fsPath
                    }));
                    const selected = await vscode.window.showQuickPick(choices, {
                        placeHolder: 'Multiple models found. Select one:'
                    });
                    if (selected) {
                        foundPath = selected.path;
                    }
                }
            }
        }
        // Strategy 4: Search by class name in file content
        if (!foundPath) {
            const allModels = await this.findFilesFuzzy(workspaceFolder, 'app/models/**/*.rb');
            const targetClassName = namespace
                ? `${namespace}::${modelName}`
                : modelName;
            for (const file of allModels) {
                const className = await this.getClassNameFromFile(file.fsPath);
                if (className &&
                    (className === targetClassName ||
                        className.endsWith(`::${modelName}`) ||
                        className.toLowerCase().includes(modelName.toLowerCase()))) {
                    foundPath = file.fsPath;
                    break;
                }
            }
        }
        // Open the file if found
        if (foundPath) {
            try {
                const document = await vscode.workspace.openTextDocument(foundPath);
                await vscode.window.showTextDocument(document);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to open model: ${modelName}`);
            }
        }
        else {
            vscode.window.showErrorMessage(`Model not found: ${namespace ? namespace + '::' : ''}${modelName}`);
        }
    }
    async navigateToController() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const currentFile = editor.document.uri.fsPath;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        let controllerName;
        let namespace = '';
        // Extract controller name and namespace based on current file type
        if (currentFile.includes('/models/')) {
            const { namespace: ns, basename } = this.extractNamespace(currentFile);
            namespace = ns;
            controllerName = this.pluralize(basename);
        }
        else if (currentFile.includes('/views/')) {
            const parts = currentFile.split('/views/');
            if (parts[1]) {
                const viewPath = parts[1];
                const pathParts = viewPath.split('/');
                // Handle namespaced views (e.g., admin/users/index.html.erb)
                if (pathParts.length > 2) {
                    namespace = pathParts.slice(0, -2).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('::');
                    controllerName = pathParts[pathParts.length - 2];
                }
                else {
                    controllerName = pathParts[0];
                }
            }
        }
        if (!controllerName) {
            controllerName = await vscode.window.showInputBox({
                prompt: 'Enter controller name (e.g., Users or Admin::Users)',
                placeHolder: 'users'
            });
        }
        if (!controllerName)
            return;
        // Handle fully qualified names (Admin::UsersController)
        if (controllerName.includes('::')) {
            const parts = controllerName.split('::');
            namespace = parts.slice(0, -1).join('::');
            controllerName = parts[parts.length - 1].replace(/Controller$/, '');
        }
        // Try multiple strategies to find the controller
        let foundPath = null;
        // Strategy 1: Exact path with namespace
        if (namespace) {
            const namespacePath = namespace.toLowerCase().replace(/::/g, '/');
            const exactPath = path.join(workspaceFolder.uri.fsPath, 'app', 'controllers', namespacePath, `${controllerName.toLowerCase()}_controller.rb`);
            if (fs.existsSync(exactPath)) {
                foundPath = exactPath;
            }
        }
        // Strategy 2: Direct path without namespace
        if (!foundPath) {
            const directPath = path.join(workspaceFolder.uri.fsPath, 'app', 'controllers', `${controllerName.toLowerCase()}_controller.rb`);
            if (fs.existsSync(directPath)) {
                foundPath = directPath;
            }
        }
        // Strategy 3: Fuzzy search across all controllers
        if (!foundPath) {
            const controllerFiles = await this.findFilesFuzzy(workspaceFolder, `app/controllers/**/${controllerName.toLowerCase()}_controller.rb`);
            if (controllerFiles.length > 0) {
                if (controllerFiles.length === 1) {
                    foundPath = controllerFiles[0].fsPath;
                }
                else {
                    // Multiple matches - let user choose
                    const choices = controllerFiles.map(file => ({
                        label: path.relative(workspaceFolder.uri.fsPath, file.fsPath),
                        path: file.fsPath
                    }));
                    const selected = await vscode.window.showQuickPick(choices, {
                        placeHolder: 'Multiple controllers found. Select one:'
                    });
                    if (selected) {
                        foundPath = selected.path;
                    }
                }
            }
        }
        // Strategy 4: Search by class name in file content
        if (!foundPath) {
            const allControllers = await this.findFilesFuzzy(workspaceFolder, 'app/controllers/**/*.rb');
            const targetClassName = namespace
                ? `${namespace}::${controllerName}Controller`
                : `${controllerName}Controller`;
            for (const file of allControllers) {
                const className = await this.getClassNameFromFile(file.fsPath);
                if (className &&
                    (className === targetClassName ||
                        className.endsWith(`::${controllerName}Controller`) ||
                        className.toLowerCase().includes(controllerName.toLowerCase()))) {
                    foundPath = file.fsPath;
                    break;
                }
            }
        }
        // Open the file if found
        if (foundPath) {
            try {
                const document = await vscode.workspace.openTextDocument(foundPath);
                await vscode.window.showTextDocument(document);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to open controller: ${controllerName}`);
            }
        }
        else {
            vscode.window.showErrorMessage(`Controller not found: ${namespace ? namespace + '::' : ''}${controllerName}Controller`);
        }
    }
    async navigateToView() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const currentFile = editor.document.uri.fsPath;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        let resourceName;
        let actionName;
        // Try to extract from controller
        if (currentFile.includes('/controllers/')) {
            const match = currentFile.match(/(\w+)_controller\.rb$/);
            if (match) {
                resourceName = match[1];
                // Try to find current method name
                const text = editor.document.getText();
                const cursorOffset = editor.document.offsetAt(editor.selection.active);
                const beforeCursor = text.substring(0, cursorOffset);
                const methodMatch = beforeCursor.match(/def\s+(\w+)\s*$/m);
                if (methodMatch) {
                    actionName = methodMatch[1];
                }
            }
        }
        if (!resourceName) {
            resourceName = await vscode.window.showInputBox({
                prompt: 'Enter resource name (plural)',
                placeHolder: 'users'
            });
        }
        if (!resourceName)
            return;
        const viewsDir = path.join(workspaceFolder.uri.fsPath, 'app', 'views', resourceName.toLowerCase());
        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(viewsDir));
            const viewFiles = files
                .filter(([name]) => name.endsWith('.html.erb') || name.endsWith('.html.haml'))
                .map(([name]) => ({
                label: name,
                description: `app/views/${resourceName}/${name}`
            }));
            if (viewFiles.length === 0) {
                vscode.window.showInformationMessage(`No views found for ${resourceName}`);
                return;
            }
            // If we know the action, try to find that view
            if (actionName) {
                const actionView = viewFiles.find(f => f.label.startsWith(actionName));
                if (actionView) {
                    const viewPath = path.join(viewsDir, actionView.label);
                    const document = await vscode.workspace.openTextDocument(viewPath);
                    await vscode.window.showTextDocument(document);
                    return;
                }
            }
            // Otherwise, show picker
            const selected = await vscode.window.showQuickPick(viewFiles, {
                placeHolder: 'Select view to open'
            });
            if (selected) {
                const viewPath = path.join(viewsDir, selected.label);
                const document = await vscode.workspace.openTextDocument(viewPath);
                await vscode.window.showTextDocument(document);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Views not found for: ${resourceName}`);
        }
    }
    async navigateToMigration() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        const currentFile = editor.document.uri.fsPath;
        let tableName;
        // Try to extract table name from model
        if (currentFile.includes('/models/')) {
            const match = currentFile.match(/(\w+)\.rb$/);
            if (match) {
                tableName = this.pluralize(match[1]);
            }
        }
        const migrationsDir = path.join(workspaceFolder.uri.fsPath, 'db', 'migrate');
        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(migrationsDir));
            let migrationFiles = files
                .filter(([name]) => name.endsWith('.rb'))
                .map(([name]) => ({
                label: name,
                description: `db/migrate/${name}`
            }));
            // Filter by table name if we have it
            if (tableName) {
                const filtered = migrationFiles.filter(f => f.label.includes(`create_${tableName}`) ||
                    f.label.includes(`add_`) && f.label.includes(`_to_${tableName}`));
                if (filtered.length > 0) {
                    migrationFiles = filtered;
                }
            }
            if (migrationFiles.length === 0) {
                vscode.window.showInformationMessage('No migrations found');
                return;
            }
            if (migrationFiles.length === 1) {
                const migrationPath = path.join(migrationsDir, migrationFiles[0].label);
                const document = await vscode.workspace.openTextDocument(migrationPath);
                await vscode.window.showTextDocument(document);
                return;
            }
            const selected = await vscode.window.showQuickPick(migrationFiles, {
                placeHolder: 'Select migration to open'
            });
            if (selected) {
                const migrationPath = path.join(migrationsDir, selected.label);
                const document = await vscode.workspace.openTextDocument(migrationPath);
                await vscode.window.showTextDocument(document);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('Migrations directory not found');
        }
    }
    async navigateToSpec() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const currentFile = editor.document.uri.fsPath;
        let specPath;
        if (currentFile.includes('/spec/')) {
            // Go from spec to implementation
            specPath = currentFile
                .replace('/spec/', '/app/')
                .replace('_spec.rb', '.rb');
        }
        else {
            // Go from implementation to spec
            specPath = currentFile
                .replace('/app/', '/spec/')
                .replace('.rb', '_spec.rb');
        }
        try {
            const document = await vscode.workspace.openTextDocument(specPath);
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            vscode.window.showWarningMessage(`File not found: ${path.basename(specPath)}`);
        }
    }
    async showRoutes() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        const routes = await this.parseRoutes(workspaceFolder.uri.fsPath);
        if (routes.length === 0) {
            vscode.window.showInformationMessage('No routes found. Run "rails routes" to see routes.');
            return;
        }
        const items = routes.map(route => ({
            label: `$(symbol-method) ${route.verb} ${route.path}`,
            description: `${route.controller}#${route.action}`,
            detail: route.name,
            route
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select route to navigate to controller action',
            matchOnDescription: true,
            matchOnDetail: true
        });
        if (selected) {
            await this.navigateToControllerAction(workspaceFolder.uri.fsPath, selected.route.controller, selected.route.action);
        }
    }
    async goToRoute() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        const routeName = await vscode.window.showInputBox({
            prompt: 'Enter route name or path',
            placeHolder: 'users_path or /users'
        });
        if (!routeName)
            return;
        const routes = await this.parseRoutes(workspaceFolder.uri.fsPath);
        const route = routes.find(r => r.name === routeName ||
            r.path === routeName ||
            r.name === routeName.replace('_path', '') ||
            r.name === routeName.replace('_url', ''));
        if (route) {
            await this.navigateToControllerAction(workspaceFolder.uri.fsPath, route.controller, route.action);
        }
        else {
            vscode.window.showWarningMessage(`Route not found: ${routeName}`);
        }
    }
    async generateModel() {
        const modelName = await vscode.window.showInputBox({
            prompt: 'Enter model name',
            placeHolder: 'User'
        });
        if (!modelName)
            return;
        // SECURITY: Sanitize model name to prevent command injection
        const sanitizedModelName = (0, shellEscape_1.sanitizeRailsName)(modelName);
        if (!sanitizedModelName) {
            vscode.window.showErrorMessage(`Invalid model name "${modelName}". Use only letters, numbers, and underscores.`);
            return;
        }
        const attributes = await vscode.window.showInputBox({
            prompt: 'Enter attributes (e.g., name:string email:string)',
            placeHolder: 'name:string email:string age:integer'
        });
        const terminal = vscode.window.createTerminal('Rails Generate');
        terminal.show();
        // SECURITY: Escape shell arguments to prevent command injection
        const escapedModelName = (0, shellEscape_1.escapeShellArg)(sanitizedModelName);
        const escapedAttributes = attributes ? (0, shellEscape_1.escapeShellArg)(attributes) : '';
        terminal.sendText(`rails generate model ${escapedModelName} ${escapedAttributes}`);
    }
    async generateController() {
        const controllerName = await vscode.window.showInputBox({
            prompt: 'Enter controller name',
            placeHolder: 'Users'
        });
        if (!controllerName)
            return;
        // SECURITY: Sanitize controller name to prevent command injection
        const sanitizedControllerName = (0, shellEscape_1.sanitizeRailsName)(controllerName);
        if (!sanitizedControllerName) {
            vscode.window.showErrorMessage(`Invalid controller name "${controllerName}". Use only letters, numbers, and underscores.`);
            return;
        }
        const actions = await vscode.window.showInputBox({
            prompt: 'Enter actions (optional)',
            placeHolder: 'index show new create'
        });
        const terminal = vscode.window.createTerminal('Rails Generate');
        terminal.show();
        // SECURITY: Escape shell arguments to prevent command injection
        const escapedControllerName = (0, shellEscape_1.escapeShellArg)(sanitizedControllerName);
        const escapedActions = actions ? (0, shellEscape_1.escapeShellArg)(actions) : '';
        terminal.sendText(`rails generate controller ${escapedControllerName} ${escapedActions}`);
    }
    async generateMigration() {
        const migrationName = await vscode.window.showInputBox({
            prompt: 'Enter migration name',
            placeHolder: 'AddEmailToUsers'
        });
        if (!migrationName)
            return;
        // SECURITY: Sanitize migration name to prevent command injection
        const sanitizedMigrationName = (0, shellEscape_1.sanitizeRailsName)(migrationName);
        if (!sanitizedMigrationName) {
            vscode.window.showErrorMessage(`Invalid migration name "${migrationName}". Use only letters, numbers, and underscores.`);
            return;
        }
        const terminal = vscode.window.createTerminal('Rails Generate');
        terminal.show();
        // SECURITY: Escape shell argument to prevent command injection
        const escapedMigrationName = (0, shellEscape_1.escapeShellArg)(sanitizedMigrationName);
        terminal.sendText(`rails generate migration ${escapedMigrationName}`);
    }
    async generateScaffold() {
        const resourceName = await vscode.window.showInputBox({
            prompt: 'Enter resource name',
            placeHolder: 'Post'
        });
        if (!resourceName)
            return;
        // SECURITY: Sanitize resource name to prevent command injection
        const sanitizedResourceName = (0, shellEscape_1.sanitizeRailsName)(resourceName);
        if (!sanitizedResourceName) {
            vscode.window.showErrorMessage(`Invalid resource name "${resourceName}". Use only letters, numbers, and underscores.`);
            return;
        }
        const attributes = await vscode.window.showInputBox({
            prompt: 'Enter attributes',
            placeHolder: 'title:string content:text'
        });
        const terminal = vscode.window.createTerminal('Rails Generate');
        terminal.show();
        // SECURITY: Escape shell arguments to prevent command injection
        const escapedResourceName = (0, shellEscape_1.escapeShellArg)(sanitizedResourceName);
        const escapedAttributes = attributes ? (0, shellEscape_1.escapeShellArg)(attributes) : '';
        terminal.sendText(`rails generate scaffold ${escapedResourceName} ${escapedAttributes}`);
    }
    async openConsole() {
        const terminal = vscode.window.createTerminal('Rails Console');
        terminal.show();
        terminal.sendText('rails console');
    }
    async showSchema() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        const schemaPath = path.join(workspaceFolder.uri.fsPath, 'db', 'schema.rb');
        try {
            const document = await vscode.workspace.openTextDocument(schemaPath);
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            vscode.window.showErrorMessage('schema.rb not found');
        }
    }
    async goToTableDefinition() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        const currentFile = editor.document.uri.fsPath;
        let tableName;
        // Extract table name from model
        if (currentFile.includes('/models/')) {
            const match = currentFile.match(/(\w+)\.rb$/);
            if (match) {
                tableName = this.pluralize(match[1]);
            }
        }
        if (!tableName) {
            tableName = await vscode.window.showInputBox({
                prompt: 'Enter table name',
                placeHolder: 'users'
            });
        }
        if (!tableName)
            return;
        const schemaPath = path.join(workspaceFolder.uri.fsPath, 'db', 'schema.rb');
        try {
            const document = await vscode.workspace.openTextDocument(schemaPath);
            const text = document.getText();
            const regex = new RegExp(`create_table\\s+"${tableName}"`, 'i');
            const match = regex.exec(text);
            if (match) {
                const position = document.positionAt(match.index);
                await vscode.window.showTextDocument(document, {
                    selection: new vscode.Range(position, position)
                });
            }
            else {
                await vscode.window.showTextDocument(document);
                vscode.window.showWarningMessage(`Table "${tableName}" not found in schema`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('schema.rb not found');
        }
    }
    async runMigrations() {
        const terminal = vscode.window.createTerminal('Rails Migrate');
        terminal.show();
        terminal.sendText('rails db:migrate');
    }
    async rollbackMigration() {
        const steps = await vscode.window.showInputBox({
            prompt: 'How many migrations to rollback? (default: 1)',
            placeHolder: '1',
            value: '1'
        });
        // SECURITY: Validate that steps is a positive integer
        const stepsValue = steps || '1';
        const stepsNum = parseInt(stepsValue, 10);
        if (isNaN(stepsNum) || stepsNum <= 0 || stepsNum > 1000) {
            vscode.window.showErrorMessage(`Invalid step count "${stepsValue}". Must be a number between 1 and 1000.`);
            return;
        }
        const terminal = vscode.window.createTerminal('Rails Rollback');
        terminal.show();
        // SECURITY: Use validated integer to prevent command injection
        terminal.sendText(`rails db:rollback STEP=${stepsNum}`);
    }
    async goToConcern() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return;
        const concernsDir = [
            path.join(workspaceFolder.uri.fsPath, 'app', 'models', 'concerns'),
            path.join(workspaceFolder.uri.fsPath, 'app', 'controllers', 'concerns')
        ];
        const concerns = [];
        for (const dir of concernsDir) {
            try {
                const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
                files.forEach(([name]) => {
                    if (name.endsWith('.rb')) {
                        concerns.push({
                            label: name.replace('.rb', ''),
                            path: path.join(dir, name)
                        });
                    }
                });
            }
            catch {
                // Directory doesn't exist, skip
            }
        }
        if (concerns.length === 0) {
            vscode.window.showInformationMessage('No concerns found');
            return;
        }
        const selected = await vscode.window.showQuickPick(concerns, {
            placeHolder: 'Select concern to open'
        });
        if (selected) {
            const document = await vscode.workspace.openTextDocument(selected.path);
            await vscode.window.showTextDocument(document);
        }
    }
    // Helper methods
    async parseRoutes(workspacePath) {
        if (this.routesCache) {
            return this.routesCache;
        }
        // Try to read routes.rb and parse basic routes
        // This is a simplified parser - in production, run `rails routes` command
        const routesPath = path.join(workspacePath, 'config', 'routes.rb');
        try {
            const content = fs.readFileSync(routesPath, 'utf8');
            const routes = [];
            // Parse resources
            const resourceMatches = content.matchAll(/resources\s+:(\w+)/g);
            for (const match of resourceMatches) {
                const resource = match[1];
                const controller = resource;
                ['index', 'show', 'new', 'create', 'edit', 'update', 'destroy'].forEach(action => {
                    routes.push({
                        name: `${resource}_${action}`,
                        verb: this.verbForAction(action),
                        path: `/${resource}`,
                        controller,
                        action
                    });
                });
            }
            // Parse individual routes
            const routeMatches = content.matchAll(/(?:get|post|put|patch|delete)\s+['"]([^'"]+)['"]\s*,\s*to:\s*['"](\w+)#(\w+)['"]/g);
            for (const match of routeMatches) {
                routes.push({
                    verb: match[0].split(' ')[0].toUpperCase(),
                    path: match[1],
                    controller: match[2],
                    action: match[3]
                });
            }
            this.routesCache = routes;
            return routes;
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to parse routes: ${error}`);
            return [];
        }
    }
    async navigateToControllerAction(workspacePath, controller, action) {
        const controllerPath = path.join(workspacePath, 'app', 'controllers', `${controller}_controller.rb`);
        try {
            const document = await vscode.workspace.openTextDocument(controllerPath);
            const text = document.getText();
            const regex = new RegExp(`def\\s+${action}\\b`);
            const match = regex.exec(text);
            if (match) {
                const position = document.positionAt(match.index);
                await vscode.window.showTextDocument(document, {
                    selection: new vscode.Range(position, position)
                });
            }
            else {
                await vscode.window.showTextDocument(document);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Controller not found: ${controller}_controller.rb`);
        }
    }
    verbForAction(action) {
        const verbMap = {
            index: 'GET',
            show: 'GET',
            new: 'GET',
            create: 'POST',
            edit: 'GET',
            update: 'PATCH',
            destroy: 'DELETE'
        };
        return verbMap[action] || 'GET';
    }
    singularize(word) {
        // Improved singularization with irregular plurals
        const irregularMap = {
            'people': 'person',
            'men': 'man',
            'women': 'woman',
            'children': 'child',
            'teeth': 'tooth',
            'feet': 'foot',
            'mice': 'mouse',
            'geese': 'goose'
        };
        const lower = word.toLowerCase();
        if (irregularMap[lower]) {
            return irregularMap[lower];
        }
        // Handle regular patterns
        if (word.endsWith('ies')) {
            return word.slice(0, -3) + 'y';
        }
        if (word.endsWith('ves')) {
            return word.slice(0, -3) + 'f';
        }
        if (word.endsWith('oes')) {
            return word.slice(0, -2);
        }
        if (word.endsWith('sses') || word.endsWith('xes') || word.endsWith('ches') || word.endsWith('shes')) {
            return word.slice(0, -2);
        }
        if (word.endsWith('s') && !word.endsWith('ss')) {
            return word.slice(0, -1);
        }
        return word;
    }
    pluralize(word) {
        // Improved pluralization with irregular plurals
        const irregularMap = {
            'person': 'people',
            'man': 'men',
            'woman': 'women',
            'child': 'children',
            'tooth': 'teeth',
            'foot': 'feet',
            'mouse': 'mice',
            'goose': 'geese'
        };
        const lower = word.toLowerCase();
        if (irregularMap[lower]) {
            return irregularMap[lower];
        }
        // Handle regular patterns
        if (word.endsWith('y') && !'aeiou'.includes(word[word.length - 2])) {
            return word.slice(0, -1) + 'ies';
        }
        if (word.endsWith('f')) {
            return word.slice(0, -1) + 'ves';
        }
        if (word.endsWith('fe')) {
            return word.slice(0, -2) + 'ves';
        }
        if (word.endsWith('o') && !'aeiou'.includes(word[word.length - 2])) {
            return word + 'es';
        }
        if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh') || word.endsWith('z')) {
            return word + 'es';
        }
        return word + 's';
    }
    /**
     * Find files using glob pattern with fuzzy matching
     */
    async findFilesFuzzy(workspaceFolder, pattern) {
        try {
            return await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, pattern), '**/node_modules/**', 100);
        }
        catch {
            return [];
        }
    }
    /**
     * Extract class name from file content
     */
    async getClassNameFromFile(filePath) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();
            // Match class definition with optional namespace
            const classMatch = text.match(/class\s+([\w:]+)/);
            if (classMatch) {
                return classMatch[1];
            }
        }
        catch {
            return null;
        }
        return null;
    }
    /**
     * Parse namespace from file path or content
     */
    extractNamespace(filePath) {
        const relativePath = filePath.split('/app/')[1];
        if (!relativePath) {
            return { namespace: '', basename: path.basename(filePath, '.rb') };
        }
        const parts = relativePath.split('/');
        const basename = path.basename(filePath, '.rb').replace('_controller', '');
        // Extract namespace from directory structure (e.g., admin/users_controller.rb)
        if (parts.length > 2) {
            const namespaceParts = parts.slice(1, -1);
            return {
                namespace: namespaceParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('::'),
                basename
            };
        }
        return { namespace: '', basename };
    }
}
exports.RailsCommands = RailsCommands;
//# sourceMappingURL=rails.js.map