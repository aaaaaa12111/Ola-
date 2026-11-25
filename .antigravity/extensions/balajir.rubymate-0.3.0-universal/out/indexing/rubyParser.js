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
exports.RubyParser = exports.NodeType = void 0;
const vscode = __importStar(require("vscode"));
var NodeType;
(function (NodeType) {
    NodeType["Class"] = "class";
    NodeType["Module"] = "module";
    NodeType["Method"] = "method";
    NodeType["MethodCall"] = "method_call";
    NodeType["Variable"] = "variable";
    NodeType["Constant"] = "constant";
    NodeType["Symbol"] = "symbol";
    NodeType["String"] = "string";
    NodeType["Comment"] = "comment";
    NodeType["Require"] = "require";
    NodeType["Include"] = "include";
    NodeType["Extend"] = "extend";
    NodeType["Association"] = "association";
    NodeType["Validation"] = "validation";
    NodeType["Scope"] = "scope";
})(NodeType || (exports.NodeType = NodeType = {}));
class RubyParser {
    constructor(document) {
        this.document = document;
        this.lines = document.getText().split('\n');
    }
    /**
     * Parse the entire document into AST
     */
    parse() {
        const nodes = [];
        let currentClass = null;
        let currentMethod = null;
        let indentStack = [0];
        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            const trimmed = line.trim();
            const indent = line.search(/\S/);
            // Skip empty lines and comments (but extract comment nodes)
            if (trimmed === '')
                continue;
            if (trimmed.startsWith('#')) {
                nodes.push(this.parseComment(line, i));
                continue;
            }
            // Handle end statements (pop context)
            if (trimmed === 'end') {
                if (currentMethod) {
                    currentMethod = null;
                }
                else if (currentClass) {
                    currentClass = null;
                }
                indentStack.pop();
                continue;
            }
            // Parse class definitions
            const classMatch = trimmed.match(/^class\s+([A-Z]\w*(?:::[A-Z]\w*)*)\s*(?:<\s*([A-Z]\w*(?:::[A-Z]\w*)*))?/);
            if (classMatch) {
                currentClass = this.parseClass(line, i, classMatch[1], classMatch[2]);
                nodes.push(currentClass);
                indentStack.push(indent);
                continue;
            }
            // Parse module definitions
            const moduleMatch = trimmed.match(/^module\s+([A-Z]\w*(?:::[A-Z]\w*)*)/);
            if (moduleMatch) {
                const moduleNode = this.parseModule(line, i, moduleMatch[1]);
                nodes.push(moduleNode);
                indentStack.push(indent);
                continue;
            }
            // Parse method definitions
            const methodMatch = trimmed.match(/^def\s+(self\.)?([a-z_]\w*[?!]?)/);
            if (methodMatch) {
                currentMethod = this.parseMethod(line, i, methodMatch[2], !!methodMatch[1]);
                if (currentClass) {
                    currentClass.methods.push(currentMethod);
                }
                else {
                    nodes.push(currentMethod);
                }
                indentStack.push(indent);
                continue;
            }
            // Parse method calls (if we're inside a method)
            if (currentMethod) {
                const calls = this.parseMethodCalls(line, i);
                currentMethod.calls.push(...calls);
            }
            // Parse ActiveRecord associations
            const associationMatch = trimmed.match(/^(has_many|has_one|belongs_to|has_and_belongs_to_many)\s+:(\w+)/);
            if (associationMatch && currentClass) {
                const assocNode = this.parseAssociation(line, i, associationMatch[1], associationMatch[2]);
                currentClass.children.push(assocNode);
            }
            // Parse includes/extends
            const includeMatch = trimmed.match(/^(include|extend|prepend)\s+([A-Z]\w*(?:::[A-Z]\w*)*)/);
            if (includeMatch && currentClass) {
                currentClass.mixins.push(includeMatch[2]);
            }
            // Parse requires
            const requireMatch = trimmed.match(/^require(?:_relative)?\s+['"](.*)['"]/);
            if (requireMatch) {
                nodes.push(this.parseRequire(line, i, requireMatch[1]));
            }
        }
        return nodes;
    }
    /**
     * Parse class definition
     */
    parseClass(line, lineNumber, name, superclass) {
        const range = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, line.length));
        return {
            type: NodeType.Class,
            name,
            range,
            children: [],
            metadata: new Map(),
            superclass,
            mixins: [],
            methods: []
        };
    }
    /**
     * Parse module definition
     */
    parseModule(line, lineNumber, name) {
        const range = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, line.length));
        return {
            type: NodeType.Module,
            name,
            range,
            children: [],
            metadata: new Map()
        };
    }
    /**
     * Parse method definition
     */
    parseMethod(line, lineNumber, name, isClassMethod) {
        const range = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, line.length));
        // Extract parameters
        const paramsMatch = line.match(/def\s+(?:self\.)?[a-z_]\w*[?!]?\s*\((.*?)\)/);
        const parameters = paramsMatch ? this.parseParameters(paramsMatch[1]) : [];
        return {
            type: NodeType.Method,
            name,
            range,
            children: [],
            metadata: new Map(),
            parameters,
            visibility: 'public',
            isClassMethod,
            calls: [],
            returns: []
        };
    }
    /**
     * Parse method parameters
     */
    parseParameters(paramsString) {
        if (!paramsString || paramsString.trim() === '')
            return [];
        const params = [];
        const parts = paramsString.split(',').map(p => p.trim());
        for (const part of parts) {
            let name = part;
            let defaultValue;
            let keyword = false;
            let splat = false;
            let block = false;
            // Block parameter (&block)
            if (part.startsWith('&')) {
                name = part.substring(1);
                block = true;
            }
            // Splat parameter (*args)
            else if (part.startsWith('**')) {
                name = part.substring(2);
                splat = true;
                keyword = true;
            }
            else if (part.startsWith('*')) {
                name = part.substring(1);
                splat = true;
            }
            // Keyword parameter (key:)
            else if (part.includes(':')) {
                const [key, value] = part.split(':').map(s => s.trim());
                name = key;
                defaultValue = value || undefined;
                keyword = true;
            }
            // Default parameter (param = value)
            else if (part.includes('=')) {
                const [key, value] = part.split('=').map(s => s.trim());
                name = key;
                defaultValue = value;
            }
            params.push({
                name,
                keyword,
                splat,
                block,
                defaultValue
            });
        }
        return params;
    }
    /**
     * Parse method calls from a line
     */
    parseMethodCalls(line, lineNumber) {
        const calls = [];
        const trimmed = line.trim();
        // Match method calls: receiver.method(args) or method(args)
        const callPattern = /([a-z_]\w*)?\.?([a-z_]\w*[?!]?)\s*(?:\(([^)]*)\))?/g;
        let match;
        while ((match = callPattern.exec(trimmed)) !== null) {
            const receiver = match[1];
            const method = match[2];
            const argsString = match[3] || '';
            // Skip keywords and common non-method tokens
            if (this.isKeyword(method))
                continue;
            calls.push({
                receiver,
                method,
                arguments: argsString ? argsString.split(',').map(a => a.trim()) : [],
                location: new vscode.Position(lineNumber, match.index)
            });
        }
        return calls;
    }
    /**
     * Parse ActiveRecord association
     */
    parseAssociation(line, lineNumber, type, name) {
        const range = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, line.length));
        const metadata = new Map();
        metadata.set('associationType', type);
        return {
            type: NodeType.Association,
            name,
            range,
            children: [],
            metadata
        };
    }
    /**
     * Parse require statement
     */
    parseRequire(line, lineNumber, path) {
        const range = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, line.length));
        const metadata = new Map();
        metadata.set('path', path);
        return {
            type: NodeType.Require,
            name: path,
            range,
            children: [],
            metadata
        };
    }
    /**
     * Parse comment
     */
    parseComment(line, lineNumber) {
        const range = new vscode.Range(new vscode.Position(lineNumber, 0), new vscode.Position(lineNumber, line.length));
        return {
            type: NodeType.Comment,
            name: line.trim(),
            range,
            children: [],
            metadata: new Map()
        };
    }
    /**
     * Check if word is a Ruby keyword
     */
    isKeyword(word) {
        const keywords = [
            'if', 'unless', 'while', 'until', 'for', 'case', 'when',
            'begin', 'rescue', 'ensure', 'return', 'yield', 'break',
            'next', 'redo', 'retry', 'raise', 'and', 'or', 'not',
            'true', 'false', 'nil', 'self', 'super', '__FILE__', '__LINE__'
        ];
        return keywords.includes(word);
    }
    /**
     * Find all method calls to a specific method name
     */
    findMethodCalls(methodName) {
        const calls = [];
        const ast = this.parse();
        const traverse = (node) => {
            if (node.type === NodeType.Method) {
                const methodNode = node;
                calls.push(...methodNode.calls.filter(c => c.method === methodName));
            }
            node.children.forEach(traverse);
        };
        ast.forEach(traverse);
        return calls;
    }
    /**
     * Find all classes in document
     */
    findClasses() {
        const classes = [];
        const ast = this.parse();
        const traverse = (node) => {
            if (node.type === NodeType.Class) {
                classes.push(node);
            }
            node.children.forEach(traverse);
        };
        ast.forEach(traverse);
        return classes;
    }
    /**
     * Get class hierarchy (superclass chain)
     */
    getClassHierarchy(className) {
        const classes = this.findClasses();
        const hierarchy = [className];
        let currentClass = classes.find(c => c.name === className);
        while (currentClass?.superclass) {
            hierarchy.push(currentClass.superclass);
            currentClass = classes.find(c => c.name === currentClass.superclass);
        }
        return hierarchy;
    }
}
exports.RubyParser = RubyParser;
//# sourceMappingURL=rubyParser.js.map