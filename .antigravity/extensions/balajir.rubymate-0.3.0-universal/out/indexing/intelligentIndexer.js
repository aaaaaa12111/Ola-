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
exports.IntelligentIndexer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs/promises"));
const rubyParser_1 = require("./rubyParser");
const semanticGraph_1 = require("./semanticGraph");
const typeInference_1 = require("./typeInference");
const smartSearch_1 = require("./smartSearch");
const referenceTracker_1 = require("./referenceTracker");
const railsIntelligence_1 = require("./railsIntelligence");
/**
 * Intelligent Indexer - Orchestrates all semantic analysis components
 */
class IntelligentIndexer {
    // Cache paths
    get cacheDir() {
        return path.join(this.context.globalStorageUri.fsPath, 'intelligent-index');
    }
    constructor(context, schemaParser, outputChannel) {
        // Indexing state
        this.isIndexing = false;
        this.fileHashes = new Map();
        this.context = context;
        this.outputChannel = outputChannel;
        this.schemaParser = schemaParser;
        // Initialize components
        this.graphBuilder = new semanticGraph_1.SemanticGraphBuilder(outputChannel);
        this.typeInference = new typeInference_1.TypeInferenceEngine(this.graphBuilder, schemaParser, outputChannel);
        this.smartSearch = new smartSearch_1.SmartSearchEngine(this.graphBuilder);
        this.referenceTracker = new referenceTracker_1.ReferenceTracker(this.graphBuilder, outputChannel);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        this.workspaceRoot = workspaceFolder?.uri.fsPath || '';
        this.railsIntelligence = new railsIntelligence_1.RailsIntelligence(this.graphBuilder, this.workspaceRoot);
    }
    /**
     * Initialize the indexer
     */
    async initialize() {
        this.outputChannel.appendLine('Initializing intelligent indexer...');
        // Create cache directory
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to create cache directory: ${error}`);
        }
        // Load cached data
        await this.loadCache();
        // Parse Rails routes
        await this.railsIntelligence.parseRoutes();
        this.outputChannel.appendLine('Intelligent indexer initialized');
    }
    /**
     * Index entire workspace
     */
    async indexWorkspace() {
        if (this.isIndexing) {
            this.outputChannel.appendLine('Indexing already in progress');
            return;
        }
        this.isIndexing = true;
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Indexing Ruby workspace",
            cancellable: true
        }, async (progress, token) => {
            const startTime = Date.now();
            // Add timeout: 5 minutes max
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Indexing timeout after 5 minutes')), 300000));
            try {
                await Promise.race([
                    this.indexWorkspaceInternal(progress, token),
                    timeoutPromise
                ]);
            }
            catch (error) {
                // Graceful degradation
                this.outputChannel.appendLine(`Indexing failed: ${error}`);
                if (error instanceof Error && error.message.includes('timeout')) {
                    vscode.window.showWarningMessage('Workspace indexing timed out after 5 minutes. Some features may be limited. Try indexing again or reduce workspace size.', 'Retry').then(selection => {
                        if (selection === 'Retry') {
                            this.isIndexing = false;
                            this.indexWorkspace();
                        }
                    });
                }
                else {
                    vscode.window.showWarningMessage(`Workspace indexing incomplete: ${error instanceof Error ? error.message : String(error)}. Some features may be limited.`);
                }
            }
            finally {
                this.isIndexing = false;
                const duration = Date.now() - startTime;
                this.outputChannel.appendLine(`Indexing completed in ${duration}ms`);
            }
        });
    }
    /**
     * Internal indexing implementation with progress reporting
     */
    async indexWorkspaceInternal(progress, token) {
        const startTime = Date.now();
        // Find all Ruby files
        progress.report({ message: 'Finding Ruby files...' });
        const files = await vscode.workspace.findFiles('**/*.rb', '**/node_modules/**');
        this.outputChannel.appendLine(`Found ${files.length} Ruby files to index`);
        if (token.isCancellationRequested) {
            this.outputChannel.appendLine('Indexing cancelled by user');
            return;
        }
        // Index in batches to avoid blocking
        const batchSize = 20;
        const totalBatches = Math.ceil(files.length / batchSize);
        const incrementPerBatch = 100 / totalBatches;
        for (let i = 0; i < files.length; i += batchSize) {
            if (token.isCancellationRequested) {
                this.outputChannel.appendLine('Indexing cancelled by user');
                return;
            }
            const batch = files.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            progress.report({
                message: `Indexing batch ${batchNumber}/${totalBatches} (${i + batch.length}/${files.length} files)`,
                increment: incrementPerBatch
            });
            await Promise.all(batch.map(uri => this.indexFile(uri)));
            // Yield to allow UI updates
            await this.sleep(10);
        }
        // Save cache
        progress.report({ message: 'Saving cache...' });
        await this.saveCache();
        const duration = Date.now() - startTime;
        this.outputChannel.appendLine(`Indexed workspace in ${duration}ms`);
        // Print statistics only if there's meaningful data
        const stats = this.getStats();
        if (stats.graph.classes > 0 || stats.graph.modules > 0 || stats.search.totalSymbols > 0) {
            this.outputChannel.appendLine(`Statistics: ${JSON.stringify(stats, null, 2)}`);
        }
        else {
            this.outputChannel.appendLine(`[INFO] Semantic graph indexing skipped (using fast symbol indexing instead)`);
        }
    }
    /**
     * Index a single file
     */
    async indexFile(uri) {
        try {
            // Check if file changed
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            const hash = this.calculateHash(content);
            if (this.fileHashes.get(uri.toString()) === hash) {
                // File unchanged, skip
                return;
            }
            this.fileHashes.set(uri.toString(), hash);
            // Parse the file
            const parser = new rubyParser_1.RubyParser(document);
            const ast = parser.parse();
            // Extract semantic information
            await this.extractSemanticInfo(uri, document, ast);
            // Track references
            await this.referenceTracker.trackReferencesInDocument(document);
            // Index symbols for search
            const symbols = await this.extractSymbols(uri, ast);
            this.smartSearch.indexSymbols(uri.toString(), symbols);
        }
        catch (error) {
            this.outputChannel.appendLine(`Error indexing ${uri.fsPath}: ${error}`);
        }
    }
    /**
     * Extract semantic information from AST
     */
    async extractSemanticInfo(uri, document, ast) {
        const filePath = uri.fsPath;
        const isModel = filePath.includes('/app/models/');
        const isController = filePath.includes('/app/controllers/');
        for (const node of ast) {
            // Extract class information
            if (node.type === rubyParser_1.NodeType.Class) {
                const classNode = node;
                const classInfo = {
                    name: classNode.name,
                    fullyQualifiedName: classNode.name,
                    location: new vscode.Location(uri, classNode.range),
                    superclass: classNode.superclass,
                    mixins: classNode.mixins,
                    subclasses: [],
                    methods: [],
                    constants: new Map(),
                    instanceVariables: [],
                    classVariables: [],
                    isRailsModel: isModel,
                    isRailsController: isController
                };
                this.graphBuilder.addClass(classInfo);
                // Extract methods
                for (const method of classNode.methods) {
                    await this.extractMethodInfo(uri, classInfo, method);
                }
                // Extract associations
                for (const child of classNode.children) {
                    if (child.type === rubyParser_1.NodeType.Association) {
                        this.extractAssociation(classInfo.name, child);
                    }
                }
                // Infer types for model attributes
                if (isModel) {
                    const attributeTypes = this.typeInference.inferModelTypes(classNode.name);
                    const associationTypes = this.typeInference.inferAssociationTypes(classNode.name);
                    // Store type information in graph
                    for (const [attr, type] of attributeTypes) {
                        this.graphBuilder.addTypeInfo({
                            symbol: attr,
                            inferredType: type.type,
                            confidence: type.confidence,
                            source: type.source,
                            location: new vscode.Location(uri, classNode.range)
                        });
                    }
                }
            }
            // Extract module information
            if (node.type === rubyParser_1.NodeType.Module) {
                const moduleInfo = {
                    name: node.name,
                    fullyQualifiedName: node.name,
                    location: new vscode.Location(uri, node.range),
                    methods: [],
                    includedIn: [],
                    extendedIn: []
                };
                this.graphBuilder.addModule(moduleInfo);
            }
        }
    }
    /**
     * Extract method information
     */
    async extractMethodInfo(uri, classInfo, methodNode) {
        const methodId = methodNode.isClassMethod
            ? `${classInfo.name}.${methodNode.name}`
            : `${classInfo.name}#${methodNode.name}`;
        const methodInfo = {
            id: methodId,
            name: methodNode.name,
            className: classInfo.name,
            location: new vscode.Location(uri, methodNode.range),
            parameters: methodNode.parameters,
            visibility: methodNode.visibility,
            isClassMethod: methodNode.isClassMethod,
            returnType: methodNode.returns.length > 0 ? methodNode.returns[0].type : undefined,
            calls: [],
            calledBy: [],
            usageCount: 0
        };
        this.graphBuilder.addMethod(methodInfo);
        // Extract method calls
        for (const call of methodNode.calls) {
            const calleeId = call.receiver
                ? `${call.receiver}#${call.method}`
                : `${classInfo.name}#${call.method}`;
            this.graphBuilder.addMethodCall({
                caller: methodId,
                callee: calleeId,
                location: new vscode.Location(uri, new vscode.Position(call.location.line, call.location.character)),
                confidence: 0.7,
                receiverType: call.receiver
            });
        }
    }
    /**
     * Extract association information
     */
    extractAssociation(className, node) {
        const associationType = node.metadata.get('associationType');
        const name = node.name;
        // Infer target model from association name
        let targetModel = name;
        if (associationType === 'has_many' || associationType === 'has_and_belongs_to_many') {
            // Singularize the name
            targetModel = name.replace(/s$/, '');
        }
        // Convert to PascalCase
        targetModel = targetModel.charAt(0).toUpperCase() + targetModel.slice(1);
        const association = {
            sourceModel: className,
            targetModel,
            type: associationType,
            name,
            location: new vscode.Location(vscode.Uri.file(''), node.range),
            options: new Map()
        };
        this.graphBuilder.addAssociation(association);
    }
    /**
     * Extract symbols for search
     */
    async extractSymbols(uri, ast) {
        const symbols = [];
        const traverse = (node, containerName) => {
            if (node.type === rubyParser_1.NodeType.Class || node.type === rubyParser_1.NodeType.Module) {
                symbols.push({
                    name: node.name,
                    kind: node.type === rubyParser_1.NodeType.Class ? vscode.SymbolKind.Class : vscode.SymbolKind.Module,
                    location: new vscode.Location(uri, node.range),
                    containerName
                });
                // Traverse methods
                if (node.methods) {
                    for (const method of node.methods) {
                        symbols.push({
                            name: method.name,
                            kind: vscode.SymbolKind.Method,
                            location: new vscode.Location(uri, method.range),
                            containerName: node.name
                        });
                    }
                }
            }
            if (node.children) {
                for (const child of node.children) {
                    traverse(child, node.name);
                }
            }
        };
        for (const node of ast) {
            traverse(node);
        }
        return symbols;
    }
    /**
     * Smart search for symbols
     */
    search(query, context) {
        const searchContext = {
            query,
            currentFile: context?.currentFile,
            currentClass: context?.currentClass,
            currentMethod: context?.currentMethod,
            fileType: context?.fileType,
            searchType: context?.searchType
        };
        return this.smartSearch.search(query, searchContext);
    }
    /**
     * Get call hierarchy for a method
     */
    getCallHierarchy(className, methodName) {
        const methodId = `${className}#${methodName}`;
        const edges = this.graphBuilder.getCallHierarchy(methodId);
        return edges.map(edge => ({
            caller: edge.caller,
            callee: edge.callee,
            location: edge.location,
            confidence: edge.confidence
        }));
    }
    /**
     * Get type hierarchy for a class
     */
    getTypeHierarchy(className) {
        return this.graphBuilder.getInheritanceChain(className);
    }
    /**
     * Get all subclasses of a class
     */
    getAllSubclasses(className) {
        return this.graphBuilder.getAllSubclasses(className);
    }
    /**
     * Find all references to a symbol
     */
    findReferences(symbolName) {
        return this.referenceTracker.findReferences(symbolName);
    }
    /**
     * Detect dead code
     */
    detectDeadCode() {
        return this.referenceTracker.detectDeadCode();
    }
    /**
     * Get Rails components for a model
     */
    async getRailsComponents(modelName) {
        return this.railsIntelligence.getRelatedComponents(modelName);
    }
    /**
     * Find view for controller action
     */
    async findViewForAction(controllerName, action) {
        return this.railsIntelligence.findViewForAction(controllerName, action);
    }
    /**
     * Get route information for controller action
     */
    getRouteInfo(controllerName, action) {
        return this.railsIntelligence.getRouteInfo(controllerName, action);
    }
    /**
     * Get available methods for a type
     */
    getAvailableMethods(typeName) {
        return this.typeInference.getAvailableMethods(typeName);
    }
    /**
     * Calculate file hash
     */
    calculateHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }
    /**
     * Save cache to disk
     */
    async saveCache() {
        try {
            const cachePath = path.join(this.cacheDir, 'index.json');
            const data = {
                fileHashes: Array.from(this.fileHashes.entries()),
                timestamp: Date.now()
            };
            await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to save cache: ${error}`);
        }
    }
    /**
     * Load cache from disk
     */
    async loadCache() {
        try {
            const cachePath = path.join(this.cacheDir, 'index.json');
            const content = await fs.readFile(cachePath, 'utf-8');
            const data = JSON.parse(content);
            this.fileHashes = new Map(data.fileHashes);
            this.outputChannel.appendLine(`Loaded cache with ${this.fileHashes.size} files`);
        }
        catch (error) {
            // Cache doesn't exist, start fresh
            this.outputChannel.appendLine('No cache found, starting fresh index');
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        const graphStats = this.graphBuilder.getStats();
        const searchStats = this.smartSearch.getStats();
        return {
            graph: graphStats,
            search: searchStats,
            files: this.fileHashes.size
        };
    }
    /**
     * Dispose
     */
    dispose() {
        this.saveCache();
    }
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.IntelligentIndexer = IntelligentIndexer;
//# sourceMappingURL=intelligentIndexer.js.map