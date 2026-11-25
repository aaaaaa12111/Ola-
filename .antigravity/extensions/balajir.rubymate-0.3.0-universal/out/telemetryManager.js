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
exports.TelemetryManager = void 0;
const vscode = __importStar(require("vscode"));
const crypto = __importStar(require("crypto"));
/**
 * Manages privacy-respecting telemetry for the extension
 */
class TelemetryManager {
    constructor(context, outputChannel) {
        // In-memory cache
        this.featureUsage = new Map();
        this.commandUsage = new Map();
        this.providerUsage = new Map();
        this.errors = [];
        this.performance = [];
        // Performance tracking
        this.operationTimers = new Map();
        // Session tracking
        this.sessionStartTime = Date.now();
        this.context = context;
        this.outputChannel = outputChannel;
        this.sessionId = this.generateSessionId();
        // Initialize telemetry reporter (respects user settings)
        this.initializeTelemetryReporter();
        // Load existing data from storage
        this.loadFromStorage();
        // Update session info
        this.updateSessionInfo();
        // Save periodically (every 5 minutes)
        this.saveInterval = setInterval(() => this.saveToStorage(), 5 * 60 * 1000);
        // Show privacy notice on first run
        this.showPrivacyNoticeIfNeeded();
        this.outputChannel.appendLine('Telemetry manager initialized (privacy-respecting mode)');
        this.outputChannel.appendLine(`Session ID: ${this.sessionId}`);
        this.outputChannel.appendLine(`Telemetry storage: VS Code GlobalState (local)`);
    }
    /**
     * Initialize VS Code's telemetry reporter
     * Only sends data if user has telemetry enabled
     */
    initializeTelemetryReporter() {
        try {
            // Create telemetry logger that respects user settings
            this.telemetryReporter = vscode.env.createTelemetryLogger({
                sendEventData: (eventName, data) => {
                    // This is only called if user has telemetry enabled
                    // You can optionally send to your own endpoint here
                    this.outputChannel.appendLine(`Telemetry event: ${eventName}`);
                },
                sendErrorData: (error, data) => {
                    // Error telemetry (only if enabled)
                    this.outputChannel.appendLine(`Telemetry error: ${error.name}`);
                    this.outputChannel.appendLine(`  Message: ${error.message}`);
                    this.outputChannel.appendLine(`  Stack: ${error.stack?.substring(0, 200)}`);
                    this.outputChannel.appendLine(`  Data: ${JSON.stringify(data)}`);
                }
            });
        }
        catch (error) {
            // Telemetry not available, continue without it
            this.outputChannel.appendLine('Telemetry reporter not available (continuing in local-only mode)');
        }
    }
    /**
     * Generate anonymized session ID
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36);
        return crypto.createHash('sha256').update(`${timestamp}-${random}`).digest('hex').substring(0, 16);
    }
    /**
     * Hash sensitive data (file paths, stack traces)
     */
    hashSensitiveData(data) {
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    }
    /**
     * Load telemetry data from VS Code storage
     */
    loadFromStorage() {
        try {
            const stored = this.context.globalState.get('rubymate.telemetry');
            if (stored) {
                this.featureUsage = new Map(Object.entries(stored.featureUsage || {}));
                this.commandUsage = new Map(Object.entries(stored.commandUsage || {}));
                this.providerUsage = new Map(Object.entries(stored.providerUsage || {}));
                this.errors = stored.errors || [];
                this.performance = stored.performance || [];
                this.outputChannel.appendLine(`Loaded telemetry data: ${this.featureUsage.size} features tracked`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to load telemetry: ${error}`);
        }
    }
    /**
     * Save telemetry data to VS Code storage (local)
     */
    async saveToStorage() {
        try {
            const data = {
                featureUsage: Object.fromEntries(this.featureUsage),
                commandUsage: Object.fromEntries(this.commandUsage),
                providerUsage: Object.fromEntries(this.providerUsage),
                errors: this.errors.slice(-100), // Keep last 100 errors
                performance: this.performance.slice(-1000), // Keep last 1000 metrics
                sessionInfo: this.context.globalState.get('rubymate.sessionInfo'),
                version: this.context.extension.packageJSON.version
            };
            await this.context.globalState.update('rubymate.telemetry', data);
            this.outputChannel.appendLine('Telemetry data saved to local storage');
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to save telemetry: ${error}`);
        }
    }
    /**
     * Update session information
     */
    updateSessionInfo() {
        const sessionInfo = this.context.globalState.get('rubymate.sessionInfo') || {
            installDate: Date.now(),
            sessionCount: 0,
            totalActivationTime: 0
        };
        sessionInfo.lastUsed = Date.now();
        sessionInfo.sessionCount += 1;
        // Track session start time for duration calculation
        this.sessionStartTime = Date.now();
        this.context.globalState.update('rubymate.sessionInfo', sessionInfo);
    }
    /**
     * Update total activation time (call on dispose)
     */
    updateActivationTime() {
        const sessionInfo = this.context.globalState.get('rubymate.sessionInfo');
        if (sessionInfo) {
            const sessionDuration = Date.now() - this.sessionStartTime;
            sessionInfo.totalActivationTime = (sessionInfo.totalActivationTime || 0) + sessionDuration;
            this.context.globalState.update('rubymate.sessionInfo', sessionInfo);
            this.outputChannel.appendLine(`Session duration: ${Math.round(sessionDuration / 1000)}s`);
        }
    }
    /**
     * Show privacy notice on first run
     */
    async showPrivacyNoticeIfNeeded() {
        const hasSeenNotice = this.context.globalState.get('rubymate.telemetry.privacyNoticeSeen');
        if (!hasSeenNotice) {
            const choice = await vscode.window.showInformationMessage('RubyMate collects anonymous usage statistics to improve the extension. ' +
                'All data is stored locally and respects VS Code\'s telemetry settings. ' +
                'No personally identifiable information is collected.', 'Learn More', 'View Statistics', 'OK');
            if (choice === 'Learn More') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/Balaji2682/rubymate#telemetry'));
            }
            else if (choice === 'View Statistics') {
                this.showStatistics();
            }
            await this.context.globalState.update('rubymate.telemetry.privacyNoticeSeen', true);
            this.outputChannel.appendLine('Privacy notice shown to user');
        }
    }
    /**
     * Track feature usage
     */
    trackFeature(featureName) {
        const current = this.featureUsage.get(featureName) || 0;
        this.featureUsage.set(featureName, current + 1);
        // Send to telemetry if enabled
        try {
            this.telemetryReporter?.logUsage('feature', {
                name: featureName,
                sessionId: this.sessionId
            });
        }
        catch (err) {
            // Silently ignore telemetry errors
        }
        // Comprehensive logging
        this.outputChannel.appendLine(`[TELEMETRY] Feature used: ${featureName} (total: ${current + 1})`);
    }
    /**
     * Track command usage
     */
    trackCommand(commandName) {
        const current = this.commandUsage.get(commandName) || 0;
        this.commandUsage.set(commandName, current + 1);
        try {
            this.telemetryReporter?.logUsage('command', {
                name: commandName,
                sessionId: this.sessionId
            });
        }
        catch (err) {
            // Silently ignore telemetry errors
        }
        // Comprehensive logging
        this.outputChannel.appendLine(`[TELEMETRY] Command executed: ${commandName} (total: ${current + 1})`);
    }
    /**
     * Track provider usage (hover, completion, etc.)
     */
    trackProvider(providerName) {
        const current = this.providerUsage.get(providerName) || 0;
        this.providerUsage.set(providerName, current + 1);
        try {
            this.telemetryReporter?.logUsage('provider', {
                name: providerName,
                sessionId: this.sessionId
            });
        }
        catch (err) {
            // Silently ignore telemetry errors
        }
        // Log every 10th use to avoid spam
        if ((current + 1) % 10 === 0) {
            this.outputChannel.appendLine(`[TELEMETRY] Provider: ${providerName} (total: ${current + 1})`);
        }
    }
    /**
     * Track error (anonymized)
     */
    trackError(errorType, feature, error) {
        // Find existing error or create new
        const existingIndex = this.errors.findIndex(e => e.errorType === errorType && e.feature === feature);
        if (existingIndex >= 0) {
            // Increment existing error count
            this.errors[existingIndex].count += 1;
            this.errors[existingIndex].timestamp = Date.now();
        }
        else {
            // Add new error
            const stackHash = error?.stack ? this.hashSensitiveData(error.stack) : undefined;
            this.errors.push({
                timestamp: Date.now(),
                errorType,
                feature,
                stackHash,
                count: 1
            });
        }
        // Send to telemetry if enabled
        try {
            this.telemetryReporter?.logUsage('error', {
                errorType,
                feature,
                sessionId: this.sessionId,
                errorMessage: error?.message,
                stackHash: error?.stack ? this.hashSensitiveData(error.stack) : undefined
            });
        }
        catch (err) {
            // Silently fail - telemetry errors shouldn't break functionality
            this.outputChannel.appendLine(`[WARN] Failed to send error telemetry: ${err}`);
        }
        // Comprehensive error logging
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`[TELEMETRY] ❌ ERROR TRACKED:`);
        this.outputChannel.appendLine(`  Type: ${errorType}`);
        this.outputChannel.appendLine(`  Feature: ${feature}`);
        this.outputChannel.appendLine(`  Count: ${existingIndex >= 0 ? this.errors[existingIndex].count : 1}`);
        if (error) {
            this.outputChannel.appendLine(`  Message: ${error.message}`);
            this.outputChannel.appendLine(`  Stack Hash: ${this.hashSensitiveData(error.stack || '')}`);
        }
        this.outputChannel.appendLine('');
    }
    /**
     * Start tracking performance for an operation
     */
    startPerformance(operation) {
        this.operationTimers.set(operation, Date.now());
    }
    /**
     * End tracking performance and record metric
     */
    endPerformance(operation, itemCount) {
        const startTime = this.operationTimers.get(operation);
        if (!startTime) {
            return;
        }
        const duration = Date.now() - startTime;
        this.operationTimers.delete(operation);
        this.performance.push({
            timestamp: Date.now(),
            operation,
            duration,
            itemCount
        });
        try {
            this.telemetryReporter?.logUsage('performance', {
                operation,
                duration: duration.toString(),
                itemCount: itemCount?.toString(),
                sessionId: this.sessionId
            });
        }
        catch (err) {
            // Silently ignore telemetry errors
        }
        this.outputChannel.appendLine(`Performance: ${operation} took ${duration}ms${itemCount ? ` (${itemCount} items)` : ''}`);
    }
    /**
     * Get usage statistics for display
     */
    getStatistics() {
        // Sort features by usage
        const topFeatures = Array.from(this.featureUsage.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        const topCommands = Array.from(this.commandUsage.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        const topProviders = Array.from(this.providerUsage.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        // Calculate average performance
        const avgPerformance = new Map();
        for (const metric of this.performance) {
            const current = avgPerformance.get(metric.operation) || { avg: 0, count: 0 };
            current.avg = ((current.avg * current.count) + metric.duration) / (current.count + 1);
            current.count += 1;
            avgPerformance.set(metric.operation, current);
        }
        // Recent errors
        const recentErrors = this.errors.slice(-10).reverse();
        return {
            topFeatures,
            topCommands,
            topProviders,
            averagePerformance: Array.from(avgPerformance.entries()).map(([op, data]) => ({
                operation: op,
                averageDuration: Math.round(data.avg),
                count: data.count
            })),
            recentErrors,
            sessionInfo: this.context.globalState.get('rubymate.sessionInfo'),
            totalFeatureUsage: Array.from(this.featureUsage.values()).reduce((a, b) => a + b, 0),
            totalCommands: Array.from(this.commandUsage.values()).reduce((a, b) => a + b, 0)
        };
    }
    /**
     * Export telemetry data to JSON file (for debugging)
     */
    async exportToFile() {
        this.outputChannel.appendLine('[TELEMETRY] Starting telemetry export...');
        const stats = this.getStatistics();
        // Add metadata to export
        const exportData = {
            exportedAt: new Date().toISOString(),
            sessionId: this.sessionId,
            extensionVersion: this.context.extension.packageJSON.version,
            vsCodeVersion: vscode.version,
            statistics: stats
        };
        const json = JSON.stringify(exportData, null, 2);
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('rubymate-telemetry.json'),
            filters: {
                'JSON': ['json']
            }
        });
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
            vscode.window.showInformationMessage(`Telemetry exported to ${uri.fsPath}`);
            this.outputChannel.appendLine(`[TELEMETRY] Exported to: ${uri.fsPath}`);
            this.outputChannel.appendLine(`[TELEMETRY] Export size: ${json.length} bytes`);
        }
        else {
            this.outputChannel.appendLine('[TELEMETRY] Export cancelled by user');
        }
    }
    /**
     * Show telemetry statistics
     */
    showStatistics() {
        const stats = this.getStatistics();
        const output = [
            '=== RubyMate Usage Statistics ===',
            '',
            '📊 Top Features:',
            ...stats.topFeatures.map(([name, count]) => `  ${name}: ${count} uses`),
            '',
            '⌨️  Top Commands:',
            ...stats.topCommands.map(([name, count]) => `  ${name}: ${count} uses`),
            '',
            '🔌 Top Providers:',
            ...stats.topProviders.map(([name, count]) => `  ${name}: ${count} uses`),
            '',
            '⚡ Performance (Average):',
            ...stats.averagePerformance.map((p) => `  ${p.operation}: ${p.averageDuration}ms (${p.count} samples)`),
            '',
            '❌ Recent Errors:',
            ...stats.recentErrors.map((e) => `  ${e.errorType} in ${e.feature} (count: ${e.count})`),
            '',
            '📈 Session Info:',
            `  Install Date: ${new Date(stats.sessionInfo.installDate).toLocaleDateString()}`,
            `  Last Used: ${new Date(stats.sessionInfo.lastUsed).toLocaleDateString()}`,
            `  Sessions: ${stats.sessionInfo.sessionCount}`,
            `  Total Feature Usage: ${stats.totalFeatureUsage}`,
            `  Total Commands: ${stats.totalCommands}`,
            '',
            '🔒 Privacy: All data stored locally. No PII collected.',
            '   Telemetry respects VS Code telemetry settings.'
        ].join('\n');
        this.outputChannel.show();
        this.outputChannel.appendLine(output);
    }
    /**
     * Clear all telemetry data
     */
    async clearData() {
        const confirm = await vscode.window.showWarningMessage('Clear all telemetry data? This cannot be undone.', 'Clear', 'Cancel');
        if (confirm === 'Clear') {
            this.featureUsage.clear();
            this.commandUsage.clear();
            this.providerUsage.clear();
            this.errors = [];
            this.performance = [];
            await this.context.globalState.update('rubymate.telemetry', undefined);
            await this.context.globalState.update('rubymate.sessionInfo', undefined);
            vscode.window.showInformationMessage('Telemetry data cleared');
            this.outputChannel.appendLine('All telemetry data cleared');
        }
    }
    /**
     * Save and cleanup
     */
    async dispose() {
        this.outputChannel.appendLine('Telemetry manager disposing...');
        // Clear interval timer
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = undefined;
        }
        // Update activation time before saving
        this.updateActivationTime();
        // Final save
        await this.saveToStorage();
        this.telemetryReporter?.dispose();
        this.outputChannel.appendLine('Telemetry manager disposed successfully');
    }
}
exports.TelemetryManager = TelemetryManager;
//# sourceMappingURL=telemetryManager.js.map