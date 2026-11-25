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
exports.DatabaseCommands = void 0;
const vscode = __importStar(require("vscode"));
const shellEscape_1 = require("../utils/shellEscape");
class DatabaseCommands {
    constructor(schemaParser, outputChannel) {
        this.schemaParser = schemaParser;
        this.outputChannel = outputChannel;
    }
    registerCommands(context) {
        // Show database schema
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.database.showSchema', () => this.showSchemaVisualization()));
        // Go to table definition in schema.rb
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.database.goToTable', () => this.goToTableDefinition()));
        // Generate migration from model
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.database.generateMigration', () => this.generateMigration()));
        // Reload schema
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.database.reloadSchema', () => this.reloadSchema()));
        // Open database console
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.database.openConsole', () => this.openDatabaseConsole()));
        // Run SQL query
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.database.runQuery', () => this.runSQLQuery()));
        // Show table columns
        context.subscriptions.push(vscode.commands.registerCommand('rubymate.database.showColumns', () => this.showTableColumns()));
    }
    /**
     * Show database schema visualization
     */
    async showSchemaVisualization() {
        try {
            const schema = this.schemaParser.getSchema();
            if (!schema) {
                vscode.window.showWarningMessage('No schema.rb found. Run migrations first.');
                return;
            }
            // Create webview panel with Content Security Policy
            const panel = vscode.window.createWebviewPanel('databaseSchema', 'Database Schema', vscode.ViewColumn.One, {
                enableScripts: false, // FIX: Disable scripts for security
                localResourceRoots: [] // FIX: No local resources needed
            });
            // FIX: Wrap HTML generation in try-catch
            try {
                panel.webview.html = this.getSchemaHTML(schema);
            }
            catch (error) {
                panel.webview.html = this.getErrorHTML(`Failed to generate schema: ${error}`);
                this.outputChannel.appendLine(`Schema HTML generation error: ${error}`);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to show schema: ${error}`);
            this.outputChannel.appendLine(`Schema visualization error: ${error}`);
        }
    }
    /**
     * FIX: Generate error HTML with proper escaping
     */
    getErrorHTML(message) {
        const escapedMessage = this.escapeHtml(message);
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-errorForeground);
                        padding: 20px;
                    }
                </style>
            </head>
            <body>
                <h2>Error</h2>
                <p>${escapedMessage}</p>
            </body>
            </html>
        `;
    }
    /**
     * FIX: HTML escape function to prevent XSS
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    /**
     * Generate HTML for schema visualization
     */
    getSchemaHTML(schema) {
        // FIX: Validate schema exists
        if (!schema || !schema.tables) {
            return this.getErrorHTML('Invalid schema data');
        }
        const tables = Array.from(schema.tables.values());
        let tablesHTML = '';
        for (const table of tables) {
            // FIX: Validate table object
            if (!table || !table.columns) {
                continue;
            }
            const columnsHTML = table.columns
                .map(col => {
                const badges = [];
                if (col.primaryKey)
                    badges.push('<span class="badge pk">PK</span>');
                if (col.foreignKey)
                    badges.push('<span class="badge fk">FK</span>');
                if (!col.nullable)
                    badges.push('<span class="badge nn">NOT NULL</span>');
                // FIX: Escape all user data to prevent HTML injection
                const colName = this.escapeHtml(col.name || 'unknown');
                const colType = this.escapeHtml(col.type || 'unknown');
                const fkTable = col.foreignKey ? this.escapeHtml(col.foreignKey.table) : '';
                return `
                        <tr>
                            <td>${colName}</td>
                            <td>${colType}</td>
                            <td>${badges.join(' ')}</td>
                            <td>${fkTable ? `→ ${fkTable}` : ''}</td>
                        </tr>
                    `;
            })
                .join('');
            const indexesHTML = table.indexes.length > 0
                ? `
                    <h4>Indexes</h4>
                    <ul>
                        ${table.indexes.map(idx => `<li>${this.escapeHtml(idx.columns.join(', '))} ${idx.unique ? '(UNIQUE)' : ''}</li>`).join('')}
                    </ul>
                `
                : '';
            // FIX: Escape table name and validate it exists
            const tableName = table.name ? this.escapeHtml(table.name) : 'Unknown';
            tablesHTML += `
                <div class="table-card">
                    <h3>${tableName}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Column</th>
                                <th>Type</th>
                                <th>Constraints</th>
                                <th>References</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${columnsHTML}
                        </tbody>
                    </table>
                    ${indexesHTML}
                </div>
            `;
        }
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    .table-card {
                        background-color: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                        padding: 16px;
                        margin-bottom: 20px;
                    }
                    h3 {
                        margin-top: 0;
                        color: var(--vscode-symbolIcon-classForeground);
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        text-align: left;
                        padding: 8px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    th {
                        font-weight: 600;
                        background-color: var(--vscode-editor-background);
                    }
                    .badge {
                        display: inline-block;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 11px;
                        font-weight: 600;
                        margin-right: 4px;
                    }
                    .badge.pk {
                        background-color: #ffc107;
                        color: #000;
                    }
                    .badge.fk {
                        background-color: #2196f3;
                        color: #fff;
                    }
                    .badge.nn {
                        background-color: #f44336;
                        color: #fff;
                    }
                    h4 {
                        margin-top: 16px;
                        margin-bottom: 8px;
                    }
                    ul {
                        margin: 0;
                        padding-left: 20px;
                    }
                </style>
            </head>
            <body>
                <h1>Database Schema</h1>
                <p>Schema version: ${schema.version || 'unknown'}</p>
                <p>Total tables: ${tables.length}</p>
                <hr>
                ${tablesHTML}
            </body>
            </html>
        `;
    }
    /**
     * Go to table definition in schema.rb
     */
    async goToTableDefinition() {
        const tables = this.schemaParser.getTableNames();
        if (tables.length === 0) {
            vscode.window.showWarningMessage('No tables found in schema.rb');
            return;
        }
        const selected = await vscode.window.showQuickPick(tables, {
            placeHolder: 'Select a table to navigate to'
        });
        if (!selected) {
            return;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }
        const schemaPath = vscode.Uri.joinPath(workspaceFolder.uri, 'db', 'schema.rb');
        try {
            const document = await vscode.workspace.openTextDocument(schemaPath);
            const text = document.getText();
            const lines = text.split('\n');
            // Find the create_table line
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`create_table "${selected}"`)) {
                    const editor = await vscode.window.showTextDocument(document);
                    const position = new vscode.Position(i, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                    break;
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Could not open schema.rb: ${error}`);
        }
    }
    /**
     * Generate migration from model
     */
    async generateMigration() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Open a model file first');
            return;
        }
        // Detect missing columns by comparing model validations with schema
        const document = editor.document;
        const text = document.getText();
        // Extract model name
        const classMatch = text.match(/class\s+(\w+)\s*</);
        if (!classMatch) {
            vscode.window.showWarningMessage('Not a valid model file');
            return;
        }
        const modelName = classMatch[1];
        const tableName = this.schemaParser.getTableNameFromModel(modelName);
        const table = this.schemaParser.getTable(tableName);
        // Extract validations
        const validations = this.extractValidations(text);
        const missingColumns = [];
        for (const attr of validations) {
            if (!table || !table.columns.find(c => c.name === attr)) {
                missingColumns.push(attr);
            }
        }
        if (missingColumns.length === 0) {
            vscode.window.showInformationMessage('All validated attributes exist in schema');
            return;
        }
        // Ask user to confirm
        const confirmed = await vscode.window.showWarningMessage(`Missing columns detected: ${missingColumns.join(', ')}. Generate migration?`, 'Yes', 'No');
        if (confirmed !== 'Yes') {
            return;
        }
        // Generate migration
        const migration = this.generateMigrationCode(tableName, missingColumns);
        // Show in new document
        const doc = await vscode.workspace.openTextDocument({
            content: migration,
            language: 'ruby'
        });
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('Migration generated. Save and run rails db:migrate');
    }
    /**
     * Extract validations from model
     */
    extractValidations(text) {
        const attributes = new Set();
        const validationRegex = /validates?\s+:(\w+)/g;
        let match;
        while ((match = validationRegex.exec(text)) !== null) {
            attributes.add(match[1]);
        }
        return Array.from(attributes);
    }
    /**
     * Generate migration code
     */
    generateMigrationCode(tableName, columns) {
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const className = `Add${columns.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('And')}To${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`;
        return `# frozen_string_literal: true

class ${className} < ActiveRecord::Migration[7.0]
  def change
    ${columns.map(col => `add_column :${tableName}, :${col}, :string`).join('\n    ')}
  end
end
`;
    }
    /**
     * Reload schema
     */
    async reloadSchema() {
        await this.schemaParser.reload();
        vscode.window.showInformationMessage('Database schema reloaded');
    }
    /**
     * Open database console
     */
    openDatabaseConsole() {
        const terminal = vscode.window.createTerminal('Database Console');
        terminal.sendText('rails dbconsole');
        terminal.show();
    }
    /**
     * Run SQL query
     */
    async runSQLQuery() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        const query = editor.document.getText(selection);
        if (!query.trim()) {
            vscode.window.showWarningMessage('Select a SQL query first');
            return;
        }
        // SECURITY: Escape the query to prevent SQL/command injection
        // This prevents malicious queries from breaking out of the heredoc
        // or executing arbitrary shell commands
        const escapedQuery = (0, shellEscape_1.escapeRubyHeredoc)(query);
        const terminal = vscode.window.createTerminal('SQL Query');
        // Use single quotes to prevent shell interpretation
        // The query is safely embedded in a Ruby heredoc with proper escaping
        terminal.sendText(`rails runner 'query = <<~SQL
${escapedQuery}
SQL
puts ActiveRecord::Base.connection.execute(query).to_a.inspect'`);
        terminal.show();
    }
    /**
     * Show table columns
     */
    async showTableColumns() {
        const tables = this.schemaParser.getTableNames();
        if (tables.length === 0) {
            vscode.window.showWarningMessage('No tables found');
            return;
        }
        const selected = await vscode.window.showQuickPick(tables, {
            placeHolder: 'Select a table'
        });
        if (!selected) {
            return;
        }
        const table = this.schemaParser.getTable(selected);
        if (!table) {
            return;
        }
        const columnInfo = table.columns
            .map(col => {
            const parts = [col.name, col.type];
            if (col.primaryKey)
                parts.push('PK');
            if (!col.nullable)
                parts.push('NOT NULL');
            if (col.foreignKey)
                parts.push(`FK → ${col.foreignKey.table}`);
            return parts.join(' | ');
        })
            .join('\n');
        const doc = await vscode.workspace.openTextDocument({
            content: `Table: ${selected}\n\n${columnInfo}`,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);
    }
}
exports.DatabaseCommands = DatabaseCommands;
//# sourceMappingURL=databaseCommands.js.map