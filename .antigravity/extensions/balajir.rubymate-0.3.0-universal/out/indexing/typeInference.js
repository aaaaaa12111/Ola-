"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeInferenceEngine = void 0;
const semanticGraph_1 = require("./semanticGraph");
class TypeInferenceEngine {
    constructor(graphBuilder, schemaParser, outputChannel) {
        // Type mappings
        this.schemaTypeToRubyType = new Map([
            ['string', 'String'],
            ['text', 'String'],
            ['integer', 'Integer'],
            ['bigint', 'Integer'],
            ['float', 'Float'],
            ['decimal', 'BigDecimal'],
            ['boolean', 'Boolean'],
            ['date', 'Date'],
            ['datetime', 'DateTime'],
            ['timestamp', 'Time'],
            ['time', 'Time'],
            ['binary', 'String'],
            ['json', 'Hash'],
            ['jsonb', 'Hash'],
            ['array', 'Array'],
            ['hstore', 'Hash']
        ]);
        this.graphBuilder = graphBuilder;
        this.schemaParser = schemaParser;
        this.outputChannel = outputChannel;
    }
    /**
     * Infer type for a variable or expression
     */
    inferType(expression, context) {
        // Try different inference strategies in order of confidence
        // 1. Schema-based (highest confidence)
        const schemaType = this.inferFromSchema(expression, context);
        if (schemaType)
            return schemaType;
        // 2. Association-based (high confidence)
        const associationType = this.inferFromAssociation(expression, context);
        if (associationType)
            return associationType;
        // 3. Method return type (medium confidence)
        const returnType = this.inferFromMethodReturn(expression, context);
        if (returnType)
            return returnType;
        // 4. Variable assignment tracking (lower confidence)
        const assignmentType = this.inferFromAssignment(expression, context);
        if (assignmentType)
            return assignmentType;
        // 5. Literal value (high confidence but limited)
        const literalType = this.inferFromLiteral(expression);
        if (literalType)
            return literalType;
        // 6. Duck typing from usage (lowest confidence)
        const duckType = this.inferFromUsage(expression, context);
        if (duckType)
            return duckType;
        return null;
    }
    /**
     * Infer type from database schema
     */
    inferFromSchema(expression, context) {
        // Check if expression is a model attribute
        // e.g., "user.email" where user is User model
        const parts = expression.split('.');
        if (parts.length !== 2)
            return null;
        const [receiver, attribute] = parts;
        // Get receiver type from context
        const receiverType = this.getVariableType(receiver, context);
        if (!receiverType)
            return null;
        // Check if receiver is a model class
        const graph = this.graphBuilder.getGraph();
        const classInfo = graph.classes.get(receiverType);
        if (!classInfo || !classInfo.isRailsModel)
            return null;
        // Get table name (conventionally pluralized, lowercased)
        const tableName = this.classNameToTableName(receiverType);
        const table = this.schemaParser.getTable(tableName);
        if (!table)
            return null;
        // Find column
        const column = table.columns.find(c => c.name === attribute);
        if (!column)
            return null;
        // Map SQL type to Ruby type
        const rubyType = this.schemaTypeToRubyType.get(column.type) || 'Object';
        return {
            type: rubyType,
            confidence: 0.95,
            source: semanticGraph_1.TypeSource.Schema
        };
    }
    /**
     * Infer type from ActiveRecord association
     */
    inferFromAssociation(expression, context) {
        const parts = expression.split('.');
        if (parts.length !== 2)
            return null;
        const [receiver, association] = parts;
        // Get receiver type
        const receiverType = this.getVariableType(receiver, context);
        if (!receiverType)
            return null;
        // Check associations
        const graph = this.graphBuilder.getGraph();
        const associations = graph.associations.get(receiverType);
        if (!associations)
            return null;
        const assoc = associations.find(a => a.name === association);
        if (!assoc)
            return null;
        // Determine type based on association type
        let type;
        switch (assoc.type) {
            case 'has_many':
            case 'has_and_belongs_to_many':
                type = `ActiveRecord::Relation<${assoc.targetModel}>`;
                break;
            case 'has_one':
            case 'belongs_to':
                type = assoc.targetModel;
                break;
            default:
                return null;
        }
        return {
            type,
            confidence: 0.9,
            source: semanticGraph_1.TypeSource.Association
        };
    }
    /**
     * Infer type from method return value
     */
    inferFromMethodReturn(expression, context) {
        // Parse method call
        const methodCallMatch = expression.match(/([a-z_]\w*)?\.?([a-z_]\w*[?!]?)\s*(?:\(.*\))?$/);
        if (!methodCallMatch)
            return null;
        const receiver = methodCallMatch[1];
        const methodName = methodCallMatch[2];
        // Get receiver type
        let receiverType = null;
        if (receiver) {
            receiverType = this.getVariableType(receiver, context);
        }
        else if (context.containingClass) {
            receiverType = context.containingClass;
        }
        if (!receiverType)
            return null;
        // Find method in graph
        const graph = this.graphBuilder.getGraph();
        const methodId = receiver
            ? `${receiverType}#${methodName}`
            : `${receiverType}.${methodName}`;
        const method = graph.methods.get(methodId);
        if (!method || !method.returnType)
            return null;
        return {
            type: method.returnType,
            confidence: 0.8,
            source: semanticGraph_1.TypeSource.MethodReturn
        };
    }
    /**
     * Infer type from variable assignment
     */
    inferFromAssignment(expression, context) {
        // This requires tracking variable assignments in the document
        // For now, return null (would need full data flow analysis)
        return null;
    }
    /**
     * Infer type from literal value
     */
    inferFromLiteral(expression) {
        const trimmed = expression.trim();
        // String literals
        if (trimmed.match(/^["'].*["']$/)) {
            return { type: 'String', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        // Number literals
        if (trimmed.match(/^\d+$/)) {
            return { type: 'Integer', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        if (trimmed.match(/^\d+\.\d+$/)) {
            return { type: 'Float', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        // Boolean literals
        if (trimmed === 'true' || trimmed === 'false') {
            return { type: 'Boolean', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        // Nil
        if (trimmed === 'nil') {
            return { type: 'NilClass', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        // Array literals
        if (trimmed.match(/^\[.*\]$/)) {
            return { type: 'Array', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        // Hash literals
        if (trimmed.match(/^\{.*\}$/)) {
            return { type: 'Hash', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        // Symbol literals
        if (trimmed.match(/^:[\w_]+$/)) {
            return { type: 'Symbol', confidence: 1.0, source: semanticGraph_1.TypeSource.Explicit };
        }
        return null;
    }
    /**
     * Infer type from usage pattern (duck typing)
     */
    inferFromUsage(expression, context) {
        // Analyze how the variable is used to infer its type
        // e.g., if we see `foo.map`, it's likely an Array or collection
        const graph = this.graphBuilder.getGraph();
        const references = graph.references.get(expression);
        if (!references || references.length === 0)
            return null;
        // Count method calls to infer type
        const methodCalls = new Map();
        for (const ref of references) {
            // Extract method calls from context
            const callMatch = ref.context.line.match(new RegExp(`${expression}\\.([a-z_]\\w*)`));
            if (callMatch) {
                const method = callMatch[1];
                methodCalls.set(method, (methodCalls.get(method) || 0) + 1);
            }
        }
        // Infer type based on common patterns
        if (methodCalls.has('each') || methodCalls.has('map') || methodCalls.has('select')) {
            return { type: 'Array', confidence: 0.6, source: semanticGraph_1.TypeSource.DuckTyped };
        }
        if (methodCalls.has('keys') || methodCalls.has('values') || methodCalls.has('fetch')) {
            return { type: 'Hash', confidence: 0.6, source: semanticGraph_1.TypeSource.DuckTyped };
        }
        if (methodCalls.has('length') || methodCalls.has('upcase') || methodCalls.has('downcase')) {
            return { type: 'String', confidence: 0.5, source: semanticGraph_1.TypeSource.DuckTyped };
        }
        if (methodCalls.has('save') || methodCalls.has('update') || methodCalls.has('destroy')) {
            return { type: 'ActiveRecord::Base', confidence: 0.7, source: semanticGraph_1.TypeSource.DuckTyped };
        }
        return null;
    }
    /**
     * Get type of a variable from context
     */
    getVariableType(varName, context) {
        // Check instance variables
        if (varName.startsWith('@')) {
            // Instance variable - type depends on class
            if (context.containingClass) {
                const graph = this.graphBuilder.getGraph();
                const classInfo = graph.classes.get(context.containingClass);
                if (classInfo?.isRailsModel) {
                    return context.containingClass;
                }
            }
            return null;
        }
        // Check local variables in context
        if (context.localVariables?.has(varName)) {
            return context.localVariables.get(varName) || null;
        }
        // Check if it's a constant (class name)
        if (varName.match(/^[A-Z]/)) {
            const graph = this.graphBuilder.getGraph();
            if (graph.classes.has(varName)) {
                return varName;
            }
        }
        return null;
    }
    /**
     * Convert class name to table name (Rails convention)
     */
    classNameToTableName(className) {
        // Remove namespace
        const simpleName = className.split('::').pop() || className;
        // Convert to snake_case and pluralize (simple version)
        const snakeCase = simpleName
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '');
        // Simple pluralization
        if (snakeCase.endsWith('y')) {
            return snakeCase.slice(0, -1) + 'ies';
        }
        else if (snakeCase.endsWith('s')) {
            return snakeCase + 'es';
        }
        else {
            return snakeCase + 's';
        }
    }
    /**
     * Infer types for all model attributes from schema
     */
    inferModelTypes(className) {
        const types = new Map();
        const tableName = this.classNameToTableName(className);
        const table = this.schemaParser.getTable(tableName);
        if (!table)
            return types;
        for (const column of table.columns) {
            const rubyType = this.schemaTypeToRubyType.get(column.type) || 'Object';
            types.set(column.name, {
                type: rubyType,
                confidence: 0.95,
                source: semanticGraph_1.TypeSource.Schema
            });
        }
        return types;
    }
    /**
     * Infer types for all associations
     */
    inferAssociationTypes(className) {
        const types = new Map();
        const graph = this.graphBuilder.getGraph();
        const associations = graph.associations.get(className);
        if (!associations)
            return types;
        for (const assoc of associations) {
            let type;
            switch (assoc.type) {
                case 'has_many':
                case 'has_and_belongs_to_many':
                    type = `ActiveRecord::Relation<${assoc.targetModel}>`;
                    break;
                case 'has_one':
                case 'belongs_to':
                    type = assoc.targetModel;
                    break;
                default:
                    continue;
            }
            types.set(assoc.name, {
                type,
                confidence: 0.9,
                source: semanticGraph_1.TypeSource.Association
            });
        }
        return types;
    }
    /**
     * Get all available methods for a type
     */
    getAvailableMethods(typeName) {
        const graph = this.graphBuilder.getGraph();
        // Check if it's a class
        const classInfo = graph.classes.get(typeName);
        if (classInfo) {
            const methods = this.graphBuilder.getAllAvailableMethods(typeName);
            return methods.map(m => m.name);
        }
        // Check if it's a collection type
        if (typeName.startsWith('ActiveRecord::Relation<')) {
            // Return ActiveRecord collection methods
            return [
                'each', 'map', 'select', 'find', 'where', 'order', 'limit',
                'offset', 'includes', 'joins', 'group', 'count', 'sum',
                'first', 'last', 'pluck', 'exists?'
            ];
        }
        // Built-in Ruby types
        if (typeName === 'String') {
            return ['length', 'upcase', 'downcase', 'strip', 'split', 'match'];
        }
        if (typeName === 'Array') {
            return ['each', 'map', 'select', 'reject', 'find', 'length', 'empty?'];
        }
        if (typeName === 'Hash') {
            return ['keys', 'values', 'fetch', 'each', 'map', 'select'];
        }
        return [];
    }
}
exports.TypeInferenceEngine = TypeInferenceEngine;
//# sourceMappingURL=typeInference.js.map