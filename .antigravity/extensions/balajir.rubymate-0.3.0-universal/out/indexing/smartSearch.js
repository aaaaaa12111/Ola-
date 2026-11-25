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
exports.SmartSearchEngine = exports.RankingFactor = void 0;
const vscode = __importStar(require("vscode"));
var RankingFactor;
(function (RankingFactor) {
    RankingFactor["ExactMatch"] = "exact_match";
    RankingFactor["PrefixMatch"] = "prefix_match";
    RankingFactor["SubstringMatch"] = "substring_match";
    RankingFactor["FuzzyMatch"] = "fuzzy_match";
    RankingFactor["UsageFrequency"] = "usage_frequency";
    RankingFactor["Recency"] = "recency";
    RankingFactor["ContextMatch"] = "context_match";
    RankingFactor["ProjectCode"] = "project_code";
    RankingFactor["FileTypeMatch"] = "file_type_match";
    RankingFactor["ScopeMatch"] = "scope_match";
})(RankingFactor || (exports.RankingFactor = RankingFactor = {}));
class SmartSearchEngine {
    constructor(graphBuilder) {
        this.symbols = new Map();
        this.usageStats = new Map();
        this.recentlyAccessed = new Map(); // symbolId → timestamp
        // Weights for different ranking factors
        this.weights = {
            exactMatch: 100,
            prefixMatch: 75,
            substringMatch: 50,
            fuzzyMatch: 25,
            usageFrequency: 20,
            recency: 15,
            contextMatch: 30,
            projectCode: 10,
            fileTypeMatch: 20,
            scopeMatch: 10
        };
        this.graphBuilder = graphBuilder;
    }
    /**
     * Add symbols to the search index
     */
    indexSymbols(uri, symbols) {
        this.symbols.set(uri, symbols);
        // Initialize usage stats for new symbols
        for (const symbol of symbols) {
            const key = this.getSymbolKey(symbol);
            if (!this.usageStats.has(key)) {
                this.usageStats.set(key, {
                    accessCount: 0,
                    lastAccessed: Date.now()
                });
            }
        }
    }
    /**
     * Search for symbols with smart ranking
     */
    search(query, context, limit = 50) {
        const allSymbols = this.getAllSymbols();
        const results = [];
        for (const symbol of allSymbols) {
            const score = this.calculateScore(symbol, query, context);
            if (score > 0) {
                const reasons = this.getRankingReasons(symbol, query, context);
                results.push({ symbol, score, reasons });
            }
        }
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        // Record access for top results
        results.slice(0, limit).forEach(r => {
            this.recordAccess(r.symbol);
        });
        return results.slice(0, limit);
    }
    /**
     * Calculate relevance score for a symbol
     */
    calculateScore(symbol, query, context) {
        let score = 0;
        const symbolName = symbol.name.toLowerCase();
        const queryLower = query.toLowerCase();
        // 1. Name matching
        if (symbolName === queryLower) {
            score += this.weights.exactMatch;
        }
        else if (symbolName.startsWith(queryLower)) {
            score += this.weights.prefixMatch;
        }
        else if (symbolName.includes(queryLower)) {
            score += this.weights.substringMatch;
        }
        else if (this.fuzzyMatch(symbolName, queryLower)) {
            score += this.weights.fuzzyMatch;
        }
        else {
            return 0; // No match at all
        }
        // 2. Usage frequency
        const usageScore = this.getUsageScore(symbol);
        score += usageScore * this.weights.usageFrequency;
        // 3. Recency
        const recencyScore = this.getRecencyScore(symbol);
        score += recencyScore * this.weights.recency;
        // 4. Context matching
        const contextScore = this.getContextScore(symbol, context);
        score += contextScore * this.weights.contextMatch;
        // 5. Project vs gem code
        if (this.isProjectCode(symbol)) {
            score += this.weights.projectCode;
        }
        // 6. File type matching
        if (this.matchesFileType(symbol, context)) {
            score += this.weights.fileTypeMatch;
        }
        // 7. Scope matching (if searching in specific scope)
        if (this.matchesScope(symbol, context)) {
            score += this.weights.scopeMatch;
        }
        return score;
    }
    /**
     * Get usage score (0-1) based on how often symbol is accessed
     */
    getUsageScore(symbol) {
        const key = this.getSymbolKey(symbol);
        const stats = this.usageStats.get(key);
        if (!stats)
            return 0;
        // Normalize access count (logarithmic scale)
        const maxAccess = 100; // Assume 100 accesses is "very popular"
        return Math.min(1, Math.log(stats.accessCount + 1) / Math.log(maxAccess));
    }
    /**
     * Get recency score (0-1) based on when symbol was last accessed
     */
    getRecencyScore(symbol) {
        const key = this.getSymbolKey(symbol);
        const timestamp = this.recentlyAccessed.get(key);
        if (!timestamp)
            return 0;
        const now = Date.now();
        const ageMs = now - timestamp;
        const ageHours = ageMs / (1000 * 60 * 60);
        // Exponential decay: recent = 1.0, 24h ago = 0.5, 1 week ago = ~0.1
        return Math.exp(-ageHours / 24);
    }
    /**
     * Get context score (0-1) based on how well symbol matches current context
     */
    getContextScore(symbol, context) {
        let score = 0;
        let factors = 0;
        const graph = this.graphBuilder.getGraph();
        // If in a controller, prefer models and views
        if (context.fileType === 'controller' && context.currentClass) {
            const controllerName = context.currentClass;
            const modelName = controllerName.replace('Controller', '').replace(/s$/, ''); // UsersController → User
            if (symbol.kind === vscode.SymbolKind.Class && symbol.name === modelName) {
                score += 1;
                factors++;
            }
        }
        // If in a model, prefer related models via associations
        if (context.fileType === 'model' && context.currentClass) {
            const associations = graph.associations.get(context.currentClass);
            if (associations) {
                const isRelatedModel = associations.some(a => a.targetModel === symbol.name);
                if (isRelatedModel) {
                    score += 0.8;
                    factors++;
                }
            }
        }
        // If in a spec, prefer the tested class/method
        if (context.fileType === 'spec' && context.currentFile) {
            const specPath = context.currentFile.fsPath;
            const testedName = this.getTestedName(specPath);
            if (symbol.name === testedName) {
                score += 1;
                factors++;
            }
        }
        // Same file = higher relevance
        if (context.currentFile && symbol.location.uri.toString() === context.currentFile.toString()) {
            score += 0.5;
            factors++;
        }
        return factors > 0 ? score / factors : 0;
    }
    /**
     * Check if symbol is from project code (not a gem)
     */
    isProjectCode(symbol) {
        const path = symbol.location.uri.fsPath;
        return !path.includes('/.gem/') &&
            !path.includes('/vendor/bundle/') &&
            !path.includes('/ruby/gems/');
    }
    /**
     * Check if symbol matches the file type context
     */
    matchesFileType(symbol, context) {
        if (!context.fileType)
            return false;
        const path = symbol.location.uri.fsPath;
        switch (context.fileType) {
            case 'model':
                return path.includes('/app/models/');
            case 'controller':
                return path.includes('/app/controllers/');
            case 'view':
                return path.includes('/app/views/');
            case 'spec':
                return path.includes('/spec/');
            default:
                return false;
        }
    }
    /**
     * Check if symbol matches the search scope
     */
    matchesScope(symbol, context) {
        if (!context.searchType || context.searchType === 'any')
            return true;
        switch (context.searchType) {
            case 'class':
                return symbol.kind === vscode.SymbolKind.Class || symbol.kind === vscode.SymbolKind.Module;
            case 'method':
                return symbol.kind === vscode.SymbolKind.Method || symbol.kind === vscode.SymbolKind.Function;
            case 'constant':
                return symbol.kind === vscode.SymbolKind.Constant;
            default:
                return true;
        }
    }
    /**
     * Fuzzy matching using camelCase/snake_case awareness
     */
    fuzzyMatch(text, pattern) {
        if (pattern.length === 0)
            return true;
        if (text.length === 0)
            return false;
        let patternIdx = 0;
        let textIdx = 0;
        while (patternIdx < pattern.length && textIdx < text.length) {
            if (text[textIdx].toLowerCase() === pattern[patternIdx].toLowerCase()) {
                patternIdx++;
            }
            textIdx++;
        }
        return patternIdx === pattern.length;
    }
    /**
     * Get ranking reasons for display
     */
    getRankingReasons(symbol, query, context) {
        const reasons = [];
        const symbolName = symbol.name.toLowerCase();
        const queryLower = query.toLowerCase();
        // Name matching reason
        if (symbolName === queryLower) {
            reasons.push({
                factor: RankingFactor.ExactMatch,
                weight: this.weights.exactMatch,
                explanation: 'Exact name match'
            });
        }
        else if (symbolName.startsWith(queryLower)) {
            reasons.push({
                factor: RankingFactor.PrefixMatch,
                weight: this.weights.prefixMatch,
                explanation: 'Name starts with query'
            });
        }
        else if (symbolName.includes(queryLower)) {
            reasons.push({
                factor: RankingFactor.SubstringMatch,
                weight: this.weights.substringMatch,
                explanation: 'Name contains query'
            });
        }
        // Usage frequency
        const usageScore = this.getUsageScore(symbol);
        if (usageScore > 0.5) {
            reasons.push({
                factor: RankingFactor.UsageFrequency,
                weight: usageScore * this.weights.usageFrequency,
                explanation: 'Frequently used'
            });
        }
        // Recency
        const recencyScore = this.getRecencyScore(symbol);
        if (recencyScore > 0.5) {
            reasons.push({
                factor: RankingFactor.Recency,
                weight: recencyScore * this.weights.recency,
                explanation: 'Recently accessed'
            });
        }
        // Context
        const contextScore = this.getContextScore(symbol, context);
        if (contextScore > 0) {
            reasons.push({
                factor: RankingFactor.ContextMatch,
                weight: contextScore * this.weights.contextMatch,
                explanation: 'Relevant to current context'
            });
        }
        // Project code
        if (this.isProjectCode(symbol)) {
            reasons.push({
                factor: RankingFactor.ProjectCode,
                weight: this.weights.projectCode,
                explanation: 'From project code'
            });
        }
        return reasons;
    }
    /**
     * Get tested name from spec file path
     */
    getTestedName(specPath) {
        const match = specPath.match(/\/([^/]+)_spec\.rb$/);
        if (match) {
            const name = match[1];
            // Convert snake_case to PascalCase
            return name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
        }
        return '';
    }
    /**
     * Record access to a symbol
     */
    recordAccess(symbol) {
        const key = this.getSymbolKey(symbol);
        const stats = this.usageStats.get(key);
        if (stats) {
            stats.accessCount++;
            stats.lastAccessed = Date.now();
        }
        this.recentlyAccessed.set(key, Date.now());
    }
    /**
     * Get unique key for a symbol
     */
    getSymbolKey(symbol) {
        return `${symbol.location.uri.toString()}:${symbol.name}:${symbol.kind}`;
    }
    /**
     * Get all symbols from all indexed files
     */
    getAllSymbols() {
        const all = [];
        for (const symbols of this.symbols.values()) {
            all.push(...symbols);
        }
        return all;
    }
    /**
     * Clear the index
     */
    clear() {
        this.symbols.clear();
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            totalSymbols: this.getAllSymbols().length,
            indexedFiles: this.symbols.size,
            usageTracked: this.usageStats.size
        };
    }
}
exports.SmartSearchEngine = SmartSearchEngine;
//# sourceMappingURL=smartSearch.js.map