"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SorbetIntegration = void 0;
var vscode = require("vscode");
var SorbetIntegration = /** @class */ (function () {
    function SorbetIntegration(outputChannel) {
        this.sorbetAvailable = false;
        // Circuit breaker for handling repeated failures
        this.failureCount = 0;
        this.disabledUntil = 0;
        this.MAX_FAILURES = 3;
        this.DISABLE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.DEFAULT_TIMEOUT = 5000; // 5 seconds
        this.outputChannel = outputChannel;
        // Note: detectSorbetExtension is now async and called via initialize()
    }
    /**
     * Initialize Sorbet integration (async)
     * Call this from extension.ts activation
     */
    SorbetIntegration.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.detectSorbetExtension()];
                    case 1:
                        _a.sent();
                        if (this.sorbetAvailable) {
                            this.startStatusPolling();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Dispose resources
     */
    SorbetIntegration.prototype.dispose = function () {
        if (this.statusPollingInterval) {
            clearInterval(this.statusPollingInterval);
        }
    };
    /**
     * Detect if Sorbet extension is installed and active
     * FIX: Made async to properly await activation and prevent race conditions
     */
    SorbetIntegration.prototype.detectSorbetExtension = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, extensionId, extension, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.outputChannel.appendLine('Checking for Sorbet extension...');
                        _i = 0, _a = SorbetIntegration.SORBET_EXTENSION_IDS;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 9];
                        extensionId = _a[_i];
                        extension = vscode.extensions.getExtension(extensionId);
                        if (!extension) return [3 /*break*/, 8];
                        this.sorbetExtension = extension;
                        this.outputChannel.appendLine("\u2713 Found Sorbet extension: ".concat(extensionId));
                        this.outputChannel.appendLine("  Active: ".concat(extension.isActive));
                        this.outputChannel.appendLine("  Version: ".concat(extension.packageJSON.version));
                        if (!!extension.isActive) return [3 /*break*/, 6];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, extension.activate()];
                    case 3:
                        _b.sent();
                        this.sorbetAvailable = true;
                        this.sorbetAPI = extension.exports;
                        this.monitorSorbetStatus();
                        this.outputChannel.appendLine('  ✓ Activated Sorbet extension');
                        return [3 /*break*/, 5];
                    case 4:
                        err_1 = _b.sent();
                        this.sorbetAvailable = false; // FIX: Explicitly set to false on error
                        this.outputChannel.appendLine("  \u2717 Failed to activate: ".concat(err_1));
                        this.handleError(err_1, 'activation');
                        return [3 /*break*/, 5];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        // Already active, get API
                        this.sorbetAvailable = true;
                        this.sorbetAPI = extension.exports;
                        this.monitorSorbetStatus();
                        _b.label = 7;
                    case 7: return [2 /*return*/];
                    case 8:
                        _i++;
                        return [3 /*break*/, 1];
                    case 9:
                        this.outputChannel.appendLine('✗ Sorbet extension not found');
                        this.outputChannel.appendLine('  RubyMate will work without Sorbet, but type information will be limited');
                        this.outputChannel.appendLine('  Install Sorbet for enhanced type checking: https://sorbet.org/');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Monitor Sorbet Language Server status via exported API
     */
    SorbetIntegration.prototype.monitorSorbetStatus = function () {
        var _this = this;
        if (!this.sorbetAPI) {
            return;
        }
        // Log current status
        if (this.sorbetAPI.status) {
            this.outputChannel.appendLine("[SORBET STATUS] ".concat(this.sorbetAPI.status));
        }
        // Subscribe to status changes
        if (this.sorbetAPI.onStatusChanged) {
            this.sorbetAPI.onStatusChanged(function (newStatus) {
                _this.outputChannel.appendLine("[SORBET STATUS] Changed to: ".concat(newStatus));
                if (newStatus === 'error') {
                    vscode.window.showWarningMessage('Sorbet Language Server encountered an error. Check output for details.', 'Show Output').then(function (selection) {
                        if (selection === 'Show Output') {
                            _this.outputChannel.show();
                        }
                    });
                }
            });
        }
    };
    /**
     * Get current Sorbet LSP status
     */
    SorbetIntegration.prototype.getSorbetStatus = function () {
        var _a;
        return (_a = this.sorbetAPI) === null || _a === void 0 ? void 0 : _a.status;
    };
    /**
     * Check if Sorbet is available
     * FIX: Now checks circuit breaker state
     */
    SorbetIntegration.prototype.isSorbetAvailable = function () {
        // Check circuit breaker first
        if (Date.now() < this.disabledUntil) {
            return false; // Circuit breaker is tripped
        }
        return this.sorbetAvailable;
    };
    /**
     * Check if Sorbet LSP is running (not just installed)
     */
    SorbetIntegration.prototype.isSorbetRunning = function () {
        var _a;
        return this.isSorbetAvailable() && ((_a = this.sorbetAPI) === null || _a === void 0 ? void 0 : _a.status) === 'running';
    };
    /**
     * FIX: Validate that URI is accessible (not a synthetic Sorbet URI)
     * Filters out sorbet:// scheme URIs that don't exist on disk
     * Prevents crashes when navigating to stdlib definitions
     */
    SorbetIntegration.prototype.isAccessibleUri = function (uri) {
        // Only allow file:// scheme
        if (uri.scheme !== 'file') {
            this.outputChannel.appendLine("[SORBET] Filtered non-file URI: ".concat(uri.toString()));
            return false;
        }
        // Reject URIs containing 'sorbet:' scheme (synthetic files)
        var uriString = uri.toString();
        if (uriString.includes('sorbet:')) {
            this.outputChannel.appendLine("[SORBET] Filtered synthetic Sorbet URI: ".concat(uriString));
            return false;
        }
        return true;
    };
    /**
     * FIX: Timeout wrapper for all Sorbet API calls
     * Prevents hanging when Sorbet LSP becomes unresponsive
     */
    SorbetIntegration.prototype.withTimeout = function (promise_1) {
        return __awaiter(this, arguments, void 0, function (promise, timeoutMs, operationName) {
            var timeout, result;
            var _this = this;
            if (timeoutMs === void 0) { timeoutMs = this.DEFAULT_TIMEOUT; }
            if (operationName === void 0) { operationName = 'operation'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timeout = new Promise(function (resolve) {
                            setTimeout(function () {
                                _this.outputChannel.appendLine("[SORBET] ".concat(operationName, " timed out after ").concat(timeoutMs, "ms"));
                                resolve(null);
                            }, timeoutMs);
                        });
                        return [4 /*yield*/, Promise.race([promise, timeout])];
                    case 1:
                        result = _a.sent();
                        if (result === null) {
                            this.recordFailure('timeout', operationName);
                        }
                        else {
                            this.recordSuccess(); // Reset failure count on success
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * FIX: Record failure for circuit breaker
     */
    SorbetIntegration.prototype.recordFailure = function (errorType, operation) {
        var _this = this;
        this.failureCount++;
        this.outputChannel.appendLine("[SORBET] Failure ".concat(this.failureCount, "/").concat(this.MAX_FAILURES, " (").concat(errorType, " in ").concat(operation, ")"));
        if (this.failureCount >= this.MAX_FAILURES) {
            this.disabledUntil = Date.now() + this.DISABLE_DURATION;
            this.outputChannel.appendLine("[SORBET] Circuit breaker tripped! Sorbet disabled for ".concat(this.DISABLE_DURATION / 1000, "s"));
            vscode.window.showWarningMessage("Sorbet integration disabled due to ".concat(this.MAX_FAILURES, " consecutive errors. ") +
                "Will retry in ".concat(this.DISABLE_DURATION / 60000, " minutes."), 'Retry Now', 'Show Output').then(function (selection) {
                if (selection === 'Retry Now') {
                    _this.resetCircuitBreaker();
                }
                else if (selection === 'Show Output') {
                    _this.outputChannel.show();
                }
            });
        }
    };
    /**
     * FIX: Record success to reset failure counter
     */
    SorbetIntegration.prototype.recordSuccess = function () {
        if (this.failureCount > 0) {
            this.outputChannel.appendLine('[SORBET] Operation succeeded, resetting failure count');
            this.failureCount = 0;
        }
    };
    /**
     * FIX: Reset circuit breaker manually or after timeout
     */
    SorbetIntegration.prototype.resetCircuitBreaker = function () {
        this.outputChannel.appendLine('[SORBET] Circuit breaker reset');
        this.failureCount = 0;
        this.disabledUntil = 0;
        vscode.window.showInformationMessage('Sorbet integration re-enabled');
    };
    /**
     * FIX: Classify errors to provide helpful messages
     */
    SorbetIntegration.prototype.classifyError = function (error) {
        var errorStr = error.toString().toLowerCase();
        if (errorStr.includes('watchman')) {
            return 'watchman';
        }
        if (errorStr.includes('sorbet/config') || errorStr.includes('not configured')) {
            return 'config';
        }
        if (errorStr.includes('crash') || errorStr.includes('segfault') || errorStr.includes('sigsegv')) {
            return 'crash';
        }
        return 'unknown';
    };
    /**
     * FIX: Handle errors with actionable user messages
     */
    SorbetIntegration.prototype.handleError = function (error, operation) {
        var _this = this;
        var errorType = this.classifyError(error);
        this.outputChannel.appendLine("[SORBET] ".concat(operation, " error (").concat(errorType, "): ").concat(error.message));
        switch (errorType) {
            case 'watchman':
                vscode.window.showErrorMessage('Sorbet requires Watchman for file watching. Install it to use Sorbet.', 'Install Guide').then(function (action) {
                    if (action === 'Install Guide') {
                        vscode.env.openExternal(vscode.Uri.parse('https://facebook.github.io/watchman/docs/install.html'));
                    }
                });
                break;
            case 'config':
                vscode.window.showErrorMessage('Sorbet not configured in this project. Run "bundle exec srb init"', 'Setup Sorbet').then(function (action) {
                    if (action === 'Setup Sorbet') {
                        _this.runSorbetInit();
                    }
                });
                break;
            case 'crash':
                vscode.window.showErrorMessage('Sorbet LSP crashed. This may be a Sorbet bug. Falling back to RubyMate.', 'Report Bug', 'Show Output').then(function (action) {
                    if (action === 'Report Bug') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/sorbet/sorbet/issues/new'));
                    }
                    else if (action === 'Show Output') {
                        _this.outputChannel.show();
                    }
                });
                break;
            default:
                // Unknown error - just log it
                this.outputChannel.appendLine("[SORBET] Unknown error: ".concat(error.stack || error.message));
                break;
        }
        this.recordFailure(errorType, operation);
    };
    /**
     * FIX: Start continuous status monitoring
     * Polls Sorbet status every 10 seconds to detect crashes
     */
    SorbetIntegration.prototype.startStatusPolling = function () {
        var _this = this;
        // Poll every 10 seconds
        this.statusPollingInterval = setInterval(function () {
            var _a;
            if (!((_a = _this.sorbetAPI) === null || _a === void 0 ? void 0 : _a.status)) {
                return;
            }
            var status = _this.sorbetAPI.status;
            if (status === 'error' || status === 'disabled') {
                _this.outputChannel.appendLine("[SORBET] Status check: ".concat(status, " - marking unavailable"));
                _this.sorbetAvailable = false;
                _this.recordFailure('status_error', 'status_poll');
            }
            else if (status === 'running') {
                // Reset on successful connection
                if (_this.failureCount > 0) {
                    _this.outputChannel.appendLine('[SORBET] Status check: running - resetting circuit breaker');
                    _this.resetCircuitBreaker();
                }
                if (!_this.sorbetAvailable) {
                    _this.outputChannel.appendLine('[SORBET] Status check: running - marking available');
                    _this.sorbetAvailable = true;
                }
            }
        }, 10000); // 10 seconds
        this.outputChannel.appendLine('[SORBET] Started status polling (10s interval)');
    };
    /**
     * Get type information for a symbol using Sorbet
     * FIX: Added timeout wrapper to prevent hangs
     */
    SorbetIntegration.prototype.getTypeInfo = function (document, position) {
        return __awaiter(this, void 0, void 0, function () {
            var hovers, typeInfo, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isSorbetAvailable()) {
                            return [2 /*return*/, null];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.withTimeout(Promise.resolve(vscode.commands.executeCommand('vscode.executeHoverProvider', document.uri, position)), this.DEFAULT_TIMEOUT, 'getTypeInfo')];
                    case 2:
                        hovers = _a.sent();
                        if (!hovers || hovers.length === 0) {
                            return [2 /*return*/, null];
                        }
                        typeInfo = this.parseSorbetHover(hovers);
                        if (typeInfo) {
                            this.outputChannel.appendLine("[SORBET] Type info: ".concat(typeInfo.type));
                        }
                        return [2 /*return*/, typeInfo];
                    case 3:
                        error_1 = _a.sent();
                        this.outputChannel.appendLine("[SORBET] Error getting type info: ".concat(error_1));
                        this.handleError(error_1, 'getTypeInfo');
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse Sorbet hover to extract type information
     */
    SorbetIntegration.prototype.parseSorbetHover = function (hovers) {
        for (var _i = 0, hovers_1 = hovers; _i < hovers_1.length; _i++) {
            var hover = hovers_1[_i];
            var contents = hover.contents;
            for (var _a = 0, contents_1 = contents; _a < contents_1.length; _a++) {
                var content = contents_1[_a];
                if (typeof content === 'string') {
                    return this.extractTypeFromMarkdown(content);
                }
                else if ('value' in content) {
                    return this.extractTypeFromMarkdown(content.value);
                }
            }
        }
        return null;
    };
    /**
     * Extract type information from Sorbet's markdown hover
     */
    SorbetIntegration.prototype.extractTypeFromMarkdown = function (markdown) {
        // Sorbet format: ```ruby\nsig { returns(Type) }\n```
        var sigMatch = markdown.match(/sig\s*\{\s*returns\(([^)]+)\)\s*\}/);
        if (sigMatch) {
            return {
                type: sigMatch[1],
                signature: sigMatch[0]
            };
        }
        // Sorbet format: Type: ClassName
        var typeMatch = markdown.match(/Type:\s*([^\n]+)/);
        if (typeMatch) {
            return {
                type: typeMatch[1].trim()
            };
        }
        // Sorbet format: ```ruby\nClassName\n```
        var codeMatch = markdown.match(/```ruby\n([^\n]+)\n```/);
        if (codeMatch) {
            return {
                type: codeMatch[1].trim()
            };
        }
        return null;
    };
    /**
     * Get enhanced definition using Sorbet
     * FIX: Added timeout wrapper and URI filtering
     */
    SorbetIntegration.prototype.getDefinition = function (document, position) {
        return __awaiter(this, void 0, void 0, function () {
            var locations, accessibleLocations, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isSorbetAvailable()) {
                            return [2 /*return*/, []];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.withTimeout(Promise.resolve(vscode.commands.executeCommand('vscode.executeDefinitionProvider', document.uri, position)), this.DEFAULT_TIMEOUT, 'getDefinition')];
                    case 2:
                        locations = _a.sent();
                        if (!locations || locations.length === 0) {
                            return [2 /*return*/, []];
                        }
                        accessibleLocations = locations.filter(function (loc) { return _this.isAccessibleUri(loc.uri); });
                        if (accessibleLocations.length > 0) {
                            this.outputChannel.appendLine("[SORBET] Found ".concat(accessibleLocations.length, "/").concat(locations.length, " accessible definition(s)"));
                        }
                        return [2 /*return*/, accessibleLocations];
                    case 3:
                        error_2 = _a.sent();
                        this.outputChannel.appendLine("[SORBET] Error getting definition: ".concat(error_2));
                        this.handleError(error_2, 'getDefinition');
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get enhanced references using Sorbet
     * FIX: Added timeout wrapper and URI filtering
     */
    SorbetIntegration.prototype.getReferences = function (document_1, position_1) {
        return __awaiter(this, arguments, void 0, function (document, position, includeDeclaration) {
            var locations, accessibleLocations, error_3;
            var _this = this;
            if (includeDeclaration === void 0) { includeDeclaration = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isSorbetAvailable()) {
                            return [2 /*return*/, []];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.withTimeout(Promise.resolve(vscode.commands.executeCommand('vscode.executeReferenceProvider', document.uri, position)), this.DEFAULT_TIMEOUT, 'getReferences')];
                    case 2:
                        locations = _a.sent();
                        if (!locations || locations.length === 0) {
                            return [2 /*return*/, []];
                        }
                        accessibleLocations = locations.filter(function (loc) { return _this.isAccessibleUri(loc.uri); });
                        if (accessibleLocations.length > 0) {
                            this.outputChannel.appendLine("[SORBET] Found ".concat(accessibleLocations.length, "/").concat(locations.length, " accessible reference(s)"));
                        }
                        return [2 /*return*/, accessibleLocations];
                    case 3:
                        error_3 = _a.sent();
                        this.outputChannel.appendLine("[SORBET] Error getting references: ".concat(error_3));
                        this.handleError(error_3, 'getReferences');
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if document has Sorbet signatures
     */
    SorbetIntegration.prototype.hasSorbetSignatures = function (document) {
        return __awaiter(this, void 0, void 0, function () {
            var text, hasSig, hasTypedComment, hasExtendSig, hasSorbet;
            return __generator(this, function (_a) {
                text = document.getText();
                hasSig = text.includes('sig {') || text.includes('sig do');
                hasTypedComment = text.includes('# typed:');
                hasExtendSig = text.includes('extend T::Sig');
                hasSorbet = hasSig || hasTypedComment || hasExtendSig;
                if (hasSorbet) {
                    this.outputChannel.appendLine("[SORBET] Document has Sorbet signatures");
                }
                return [2 /*return*/, hasSorbet];
            });
        });
    };
    /**
     * Get Sorbet type level for file
     * FIX: Check first 50 lines instead of 10 (handles long file headers)
     */
    SorbetIntegration.prototype.getSorbetTypeLevel = function (document) {
        var text = document.getText();
        // FIX: Check first 50 lines for # typed: comment (handles copyright headers, etc.)
        var lines = text.split('\n').slice(0, 50);
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var match = line.match(/# typed:\s*(\w+)/);
            if (match) {
                return match[1]; // strict, strong, true, false, ignore
            }
        }
        return null;
    };
    /**
     * Enhance hover with Sorbet type information
     */
    SorbetIntegration.prototype.enhanceHover = function (document, position, baseHover) {
        return __awaiter(this, void 0, void 0, function () {
            var typeInfo, typeMarkdown, combined;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getTypeInfo(document, position)];
                    case 1:
                        typeInfo = _a.sent();
                        if (!typeInfo) {
                            return [2 /*return*/, baseHover];
                        }
                        typeMarkdown = new vscode.MarkdownString();
                        typeMarkdown.appendCodeblock("Type: ".concat(typeInfo.type), 'ruby');
                        if (typeInfo.signature) {
                            typeMarkdown.appendMarkdown('\n\n');
                            typeMarkdown.appendCodeblock(typeInfo.signature, 'ruby');
                        }
                        if (typeInfo.documentation) {
                            typeMarkdown.appendMarkdown('\n\n');
                            typeMarkdown.appendMarkdown(typeInfo.documentation);
                        }
                        // Combine with base hover if it exists
                        if (baseHover) {
                            combined = new vscode.Hover(__spreadArray(__spreadArray([], baseHover.contents, true), [
                                new vscode.MarkdownString('---'),
                                typeMarkdown
                            ], false));
                            return [2 /*return*/, combined];
                        }
                        return [2 /*return*/, new vscode.Hover(typeMarkdown)];
                }
            });
        });
    };
    /**
     * Show Sorbet status in output
     */
    SorbetIntegration.prototype.showStatus = function () {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('=== Sorbet Integration Status ===');
        this.outputChannel.appendLine("Available: ".concat(this.sorbetAvailable ? '✓ Yes' : '✗ No'));
        if (this.sorbetExtension) {
            this.outputChannel.appendLine("Extension: ".concat(this.sorbetExtension.id));
            this.outputChannel.appendLine("Version: ".concat(this.sorbetExtension.packageJSON.version));
            this.outputChannel.appendLine("Active: ".concat(this.sorbetExtension.isActive));
        }
        else {
            this.outputChannel.appendLine('Extension: Not installed');
            this.outputChannel.appendLine('');
            this.outputChannel.appendLine('To install Sorbet:');
            this.outputChannel.appendLine('1. Install extension: https://marketplace.visualstudio.com/items?itemName=sorbet.sorbet-vscode-extension');
            this.outputChannel.appendLine('2. Add to Gemfile: gem "sorbet", group: :development');
            this.outputChannel.appendLine('3. Run: bundle exec srb init');
        }
        this.outputChannel.appendLine('');
    };
    /**
     * Check if Sorbet is configured in workspace
     */
    SorbetIntegration.prototype.isSorbetConfigured = function () {
        return __awaiter(this, void 0, void 0, function () {
            var workspaceFolder, sorbetDir, stat, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        workspaceFolder = (_b = vscode.workspace.workspaceFolders) === null || _b === void 0 ? void 0 : _b[0];
                        if (!workspaceFolder) {
                            return [2 /*return*/, false];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        sorbetDir = vscode.Uri.joinPath(workspaceFolder.uri, 'sorbet');
                        return [4 /*yield*/, vscode.workspace.fs.stat(sorbetDir)];
                    case 2:
                        stat = _c.sent();
                        if (stat.type === vscode.FileType.Directory) {
                            this.outputChannel.appendLine('[SORBET] Found sorbet/ directory - project is configured');
                            return [2 /*return*/, true];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _c.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, false];
                }
            });
        });
    };
    /**
     * Prompt user to setup Sorbet if extension installed but not configured
     */
    SorbetIntegration.prototype.promptSorbetSetup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var isConfigured, selection;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.sorbetAvailable) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.isSorbetConfigured()];
                    case 1:
                        isConfigured = _a.sent();
                        if (isConfigured) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, vscode.window.showInformationMessage('Sorbet extension detected but project not configured. Setup Sorbet?', 'Setup Now', 'Learn More', 'Not Now')];
                    case 2:
                        selection = _a.sent();
                        if (!(selection === 'Setup Now')) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.runSorbetInit()];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        if (!(selection === 'Learn More')) return [3 /*break*/, 6];
                        return [4 /*yield*/, vscode.env.openExternal(vscode.Uri.parse('https://sorbet.org/docs/adopting'))];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Run sorbet init command to setup project
     */
    SorbetIntegration.prototype.runSorbetInit = function () {
        return __awaiter(this, void 0, void 0, function () {
            var workspaceFolder, terminal;
            var _a;
            return __generator(this, function (_b) {
                workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
                if (!workspaceFolder) {
                    return [2 /*return*/];
                }
                terminal = vscode.window.createTerminal({
                    name: 'Sorbet Setup',
                    cwd: workspaceFolder.uri.fsPath
                });
                terminal.show();
                terminal.sendText('# Setting up Sorbet...');
                terminal.sendText('# Step 1: Install Sorbet gem');
                terminal.sendText('bundle add sorbet --group development');
                terminal.sendText('# Step 2: Initialize Sorbet');
                terminal.sendText('bundle exec srb init');
                terminal.sendText('# Step 3: Generate RBI files');
                terminal.sendText('bundle exec srb rbi update');
                terminal.sendText('echo "✓ Sorbet setup complete! Reload window to activate."');
                vscode.window.showInformationMessage('Sorbet setup commands sent to terminal. Reload window after completion.', 'Reload Window').then(function (selection) {
                    if (selection === 'Reload Window') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
                return [2 /*return*/];
            });
        });
    };
    // Known Sorbet extension IDs
    SorbetIntegration.SORBET_EXTENSION_IDS = [
        'sorbet.sorbet-vscode-extension', // Official Sorbet extension
        'shopify.ruby-lsp' // Shopify Ruby LSP (includes Sorbet)
    ];
    return SorbetIntegration;
}());
exports.SorbetIntegration = SorbetIntegration;
