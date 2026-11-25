"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticGraphBuilder = exports.TypeSource = exports.AssociationType = exports.DependencyType = exports.ReferenceType = void 0;
var ReferenceType;
(function (ReferenceType) {
    ReferenceType["Definition"] = "definition";
    ReferenceType["Read"] = "read";
    ReferenceType["Write"] = "write";
    ReferenceType["Call"] = "call";
    ReferenceType["Instantiation"] = "instantiation";
})(ReferenceType || (exports.ReferenceType = ReferenceType = {}));
var DependencyType;
(function (DependencyType) {
    DependencyType["Require"] = "require";
    DependencyType["RequireRelative"] = "require_relative";
    DependencyType["Autoload"] = "autoload";
    DependencyType["Include"] = "include";
    DependencyType["Extend"] = "extend";
})(DependencyType || (exports.DependencyType = DependencyType = {}));
var AssociationType;
(function (AssociationType) {
    AssociationType["HasMany"] = "has_many";
    AssociationType["HasOne"] = "has_one";
    AssociationType["BelongsTo"] = "belongs_to";
    AssociationType["HasAndBelongsToMany"] = "has_and_belongs_to_many";
    AssociationType["HasManyThrough"] = "has_many_through";
})(AssociationType || (exports.AssociationType = AssociationType = {}));
var TypeSource;
(function (TypeSource) {
    TypeSource["Explicit"] = "explicit";
    TypeSource["Schema"] = "schema";
    TypeSource["Association"] = "association";
    TypeSource["MethodReturn"] = "method_return";
    TypeSource["Inferred"] = "inferred";
    TypeSource["DuckTyped"] = "duck_typed"; // From usage pattern
})(TypeSource || (exports.TypeSource = TypeSource = {}));
/**
 * Semantic Graph Builder - Constructs and maintains the semantic graph
 */
class SemanticGraphBuilder {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.graph = this.createEmptyGraph();
    }
    createEmptyGraph() {
        return {
            classes: new Map(),
            modules: new Map(),
            methods: new Map(),
            callGraph: new Map(),
            references: new Map(),
            dependencies: new Map(),
            associations: new Map(),
            typeInfo: new Map()
        };
    }
    /**
     * Get the semantic graph
     */
    getGraph() {
        return this.graph;
    }
    /**
     * Add a class to the graph
     */
    addClass(classInfo) {
        this.graph.classes.set(classInfo.fullyQualifiedName, classInfo);
        // Update superclass's subclasses
        if (classInfo.superclass) {
            const superclass = this.graph.classes.get(classInfo.superclass);
            if (superclass && !superclass.subclasses.includes(classInfo.fullyQualifiedName)) {
                superclass.subclasses.push(classInfo.fullyQualifiedName);
            }
        }
        // Update included modules
        for (const mixin of classInfo.mixins) {
            const module = this.graph.modules.get(mixin);
            if (module && !module.includedIn.includes(classInfo.fullyQualifiedName)) {
                module.includedIn.push(classInfo.fullyQualifiedName);
            }
        }
    }
    /**
     * Add a module to the graph
     */
    addModule(moduleInfo) {
        this.graph.modules.set(moduleInfo.fullyQualifiedName, moduleInfo);
    }
    /**
     * Add a method to the graph
     */
    addMethod(methodInfo) {
        this.graph.methods.set(methodInfo.id, methodInfo);
        // Add to class's method list
        if (methodInfo.className) {
            const classInfo = this.graph.classes.get(methodInfo.className);
            if (classInfo && !classInfo.methods.includes(methodInfo.id)) {
                classInfo.methods.push(methodInfo.id);
            }
        }
    }
    /**
     * Add a method call edge to the call graph
     */
    addMethodCall(edge) {
        // Add to call graph
        const existing = this.graph.callGraph.get(edge.caller) || [];
        existing.push(edge);
        this.graph.callGraph.set(edge.caller, existing);
        // Update caller's calls list
        const caller = this.graph.methods.get(edge.caller);
        if (caller && !caller.calls.includes(edge.callee)) {
            caller.calls.push(edge.callee);
        }
        // Update callee's calledBy list
        const callee = this.graph.methods.get(edge.callee);
        if (callee && !callee.calledBy.includes(edge.caller)) {
            callee.calledBy.push(edge.caller);
            callee.usageCount++;
        }
    }
    /**
     * Add a reference to a symbol
     */
    addReference(reference) {
        const existing = this.graph.references.get(reference.symbolName) || [];
        existing.push(reference);
        this.graph.references.set(reference.symbolName, existing);
    }
    /**
     * Add a file dependency
     */
    addDependency(dependency) {
        const key = dependency.from.toString();
        const existing = this.graph.dependencies.get(key) || [];
        existing.push(dependency);
        this.graph.dependencies.set(key, existing);
    }
    /**
     * Add an ActiveRecord association
     */
    addAssociation(association) {
        const existing = this.graph.associations.get(association.sourceModel) || [];
        existing.push(association);
        this.graph.associations.set(association.sourceModel, existing);
    }
    /**
     * Add type information
     */
    addTypeInfo(typeInfo) {
        const key = `${typeInfo.location.uri.toString()}:${typeInfo.symbol}`;
        // Only update if confidence is higher or source is more reliable
        const existing = this.graph.typeInfo.get(key);
        if (!existing || this.isMoreReliable(typeInfo, existing)) {
            this.graph.typeInfo.set(key, typeInfo);
        }
    }
    /**
     * Check if new type info is more reliable than existing
     */
    isMoreReliable(newInfo, existing) {
        const sourceOrder = [
            TypeSource.Explicit,
            TypeSource.Schema,
            TypeSource.Association,
            TypeSource.MethodReturn,
            TypeSource.Inferred,
            TypeSource.DuckTyped
        ];
        const newSourceIndex = sourceOrder.indexOf(newInfo.source);
        const existingSourceIndex = sourceOrder.indexOf(existing.source);
        if (newSourceIndex < existingSourceIndex)
            return true;
        if (newSourceIndex > existingSourceIndex)
            return false;
        // Same source, use confidence
        return newInfo.confidence > existing.confidence;
    }
    /**
     * Get all subclasses of a class (recursive)
     */
    getAllSubclasses(className) {
        const result = [];
        const classInfo = this.graph.classes.get(className);
        if (!classInfo)
            return result;
        for (const subclass of classInfo.subclasses) {
            result.push(subclass);
            result.push(...this.getAllSubclasses(subclass));
        }
        return result;
    }
    /**
     * Get full inheritance chain for a class
     */
    getInheritanceChain(className) {
        const chain = [className];
        let currentClass = this.graph.classes.get(className);
        while (currentClass?.superclass) {
            chain.push(currentClass.superclass);
            currentClass = this.graph.classes.get(currentClass.superclass);
        }
        return chain;
    }
    /**
     * Get all methods available to a class (including inherited and mixed-in)
     */
    getAllAvailableMethods(className) {
        const methods = [];
        const classInfo = this.graph.classes.get(className);
        if (!classInfo)
            return methods;
        // Get own methods
        for (const methodId of classInfo.methods) {
            const method = this.graph.methods.get(methodId);
            if (method)
                methods.push(method);
        }
        // Get inherited methods
        if (classInfo.superclass) {
            methods.push(...this.getAllAvailableMethods(classInfo.superclass));
        }
        // Get methods from included modules
        for (const mixin of classInfo.mixins) {
            const module = this.graph.modules.get(mixin);
            if (module) {
                for (const methodId of module.methods) {
                    const method = this.graph.methods.get(methodId);
                    if (method)
                        methods.push(method);
                }
            }
        }
        return methods;
    }
    /**
     * Get call hierarchy for a method (who calls this method)
     */
    getCallHierarchy(methodId, visited = new Set()) {
        if (visited.has(methodId))
            return [];
        visited.add(methodId);
        const method = this.graph.methods.get(methodId);
        if (!method)
            return [];
        const calls = [];
        // Find all edges where this method is the callee
        for (const [caller, edges] of this.graph.callGraph) {
            for (const edge of edges) {
                if (edge.callee === methodId) {
                    calls.push(edge);
                    // Recursively get callers of caller
                    calls.push(...this.getCallHierarchy(caller, visited));
                }
            }
        }
        return calls;
    }
    /**
     * Find unused methods (dead code)
     */
    findUnusedMethods() {
        const unused = [];
        for (const [id, method] of this.graph.methods) {
            // Skip public methods (might be called externally)
            if (method.visibility === 'public')
                continue;
            // Skip Rails controller actions
            if (method.className?.includes('Controller'))
                continue;
            // Check if method is never called
            if (method.calledBy.length === 0 && method.usageCount === 0) {
                unused.push(method);
            }
        }
        return unused;
    }
    /**
     * Find unused classes (dead code)
     */
    findUnusedClasses() {
        const unused = [];
        for (const [name, classInfo] of this.graph.classes) {
            // Skip Rails models and controllers
            if (classInfo.isRailsModel || classInfo.isRailsController)
                continue;
            // Check if class is instantiated or referenced
            const references = this.graph.references.get(name) || [];
            const hasInstantiation = references.some(r => r.type === ReferenceType.Instantiation ||
                r.type === ReferenceType.Call);
            // Check if any methods are called
            const hasMethodCalls = classInfo.methods.some(methodId => {
                const method = this.graph.methods.get(methodId);
                return method && method.calledBy.length > 0;
            });
            if (!hasInstantiation && !hasMethodCalls && classInfo.subclasses.length === 0) {
                unused.push(classInfo);
            }
        }
        return unused;
    }
    /**
     * Get Rails component mapping (Model → Controller → Views)
     */
    getRailsComponents(modelName) {
        const result = {
            model: undefined,
            controller: undefined,
            views: [],
            specs: []
        };
        // Find model
        const modelClass = this.graph.classes.get(modelName);
        if (modelClass) {
            result.model = modelClass.location;
        }
        // Find controller (e.g., User → UsersController)
        const controllerName = `${modelName}sController`;
        const controller = this.graph.classes.get(controllerName);
        if (controller) {
            result.controller = controller.location;
        }
        // Views and specs would need file system search
        // (implemented in separate provider)
        return result;
    }
    /**
     * Clear the graph
     */
    clear() {
        this.graph = this.createEmptyGraph();
    }
    /**
     * Get statistics
     */
    getStats() {
        let callEdges = 0;
        for (const edges of this.graph.callGraph.values()) {
            callEdges += edges.length;
        }
        let references = 0;
        for (const refs of this.graph.references.values()) {
            references += refs.length;
        }
        return {
            classes: this.graph.classes.size,
            modules: this.graph.modules.size,
            methods: this.graph.methods.size,
            callEdges,
            references
        };
    }
}
exports.SemanticGraphBuilder = SemanticGraphBuilder;
//# sourceMappingURL=semanticGraph.js.map