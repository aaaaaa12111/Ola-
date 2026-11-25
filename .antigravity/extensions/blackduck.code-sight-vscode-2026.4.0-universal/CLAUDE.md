# Code Sight VS Code Extension - AI Assistant Reference

This document provides comprehensive information about the Code Sight VS Code extension codebase to enable effective AI assistance.

## Project Overview

**Code Sight** is a comprehensive security and quality VS Code extension by Black Duck Software. It integrates with multiple Black Duck products (Polaris, Coverity, Black Duck SCA, Software Risk Manager) to provide:

- **Local View**: Real-time scanning of local code changes in the IDE
- **Team View**: Centralized pipeline-based scan results from Black Duck servers
- **Issue Management**: Security vulnerability detection, tracking, and remediation
- **Open Source Analysis**: Software composition analysis for dependencies

## Technology Stack & Architecture

### Core Technologies
- **TypeScript 4.9.5** - Primary development language
- **VS Code Extension API** - Base platform integration
- **Node.js 18.19.1** - Runtime environment
- **gRPC** - Backend communication protocol
- **Webpack 5.94.0** - Module bundling
- **React/TSX** - Webview UI components
- **Gulp** - Build automation and tasks

### Key Dependencies
- `@codesight/codesight-controller` - Core scanning engine client
- `@grpc/grpc-js` - gRPC client implementation
- `node-dependency-injection` - Service container and DI
- `winston` - Structured logging
- `vscode-nls` - Internationalization support
- `tabulator-tables` - Advanced data tables
- `moment` - Date/time utilities

## Project Structure

```
src/
├── controller/          # gRPC clients for backend services
├── extension.ts         # Main extension entry point
├── models/             # Domain models and data structures
├── services/           # Business logic and state management
├── sigma/              # Sigma tool integration
├── utils/              # Shared utilities and helpers
└── views/              # UI components and view providers

webview-ui/             # React-based webview components
webview-model/          # Shared models for webview communication
resources/              # Icons, assets, and resources
scripts/                # Build and deployment scripts
```

### Core Directories Explained

**`src/services/`** - Business logic layer with dependency injection:
- Authentication, configuration, scanning, licensing services
- Service container pattern with type-safe dependency injection
- Event-driven architecture with listener patterns

**`src/views/`** - UI layer following presenter/provider pattern:
- Tree view providers for VS Code native UI
- Webview providers for complex HTML/React UI
- Presenters coordinate between services and views

**`src/controller/`** - gRPC client abstraction:
- Service-specific clients (issues, analysis, diagnostics, etc.)
- Automatic controller binary management and lifecycle
- Connection pooling and health monitoring

**`src/models/`** - Domain models:
- Rich domain objects (`NewIssue`, `NewEvent`, etc.)
- Protocol buffer integration
- Hierarchical data structures for security findings

## Development Workflow

### Build Commands
```bash
# Full build with linting and compilation
npm run compile
npx gulp compile

# Development build with webpack
npm run webpack
npm run webpack-no-lint    # Skip linting

# Production build
npm run vscode:prepublish

# Watch mode for development
npm run watch
```

### Testing Commands
```bash
# Prepare test workspace
npm run prepare-test-workspace
npx gulp prepareTestWorkspace

# Quick single-version test (fastest, recommended for development)
npx gulp test:quick                           # Test against newest supported version (currently 1.105.0)
npx gulp test:quick --version 1.96.0          # Test against specific version
npx gulp test:quick --match "Local View"     # Test only matching suites/tests

# Run tests against stable releases (10+ versions, ~15 minutes)
npx gulp test:releases
npx gulp test:releases --match "Signal"      # Filter to specific test suites

# Run tests against insiders version only
npx gulp test:insiders

# Run ALL tests (releases + insiders, very slow - avoid during development)
npx gulp test

# Coverage analysis
npm run coverage
npx gulp cover:clean
```

**Test Filtering by Suite Name:**
Use the `--match` flag to filter tests by suite or test name (uses Mocha's grep functionality):
```bash
# Run only tests with "Local View" in the suite/test name
npx gulp test:quick --match "Local View"

# Run only Signal mode tests
npx gulp test:quick --match "Signal"

# Run tests matching a regex pattern
npx gulp test:quick --match "Manual.*Results"
```

**Best Practices for Running Tests:**
- **During active development**: Use `npx gulp test:quick` (single version, ~1-2 minutes) for rapid iteration
- **Testing specific features**: Combine `npx gulp test:quick --match "Suite Name"` to run only relevant tests
- **Before committing**: Run `npx gulp test:releases` at minimum to ensure compatibility across supported versions
- **Custom versions**: Use `npx gulp test:quick --version X.Y.Z` to test against a specific VS Code version
- **CI/CD only**: Full `npx gulp test` suite (all 11 versions) should run in automated pipelines

**Examples:**
```bash
# Fastest: Test Local View changes against newest version
npx gulp test:quick --match "Local View"

# Quick full test suite against newest supported version
npx gulp test:quick

# Test against older/specific version
npx gulp test:quick --version 1.96.0

# Test specific feature across all supported versions (slower but thorough)
npx gulp test:releases --match "Signal mode"
```

### Build Process
1. **Linting**: ESLint checks with copyright header validation
2. **TypeScript Compilation**: Source compilation with path mapping
3. **Internationalization**: NLS bundle creation for localization
4. **Webpack Bundling**: Production-ready extension bundle
5. **Asset Processing**: Icon and resource optimization

## Key Architectural Patterns

### 1. Dependency Injection Architecture
```typescript
// Service registration pattern
class ServiceContainer {
  static register<T>(serviceId: ServiceId<T>, factory: () => T): void
  static getService<T>(serviceId: ServiceId<T>): T
}

// Service implementation pattern
class AuthenticationServiceImpl implements AuthenticationService {
  static readonly id = ServiceId.create<AuthenticationService>('AuthenticationService');
  // Implementation...
}
```

### 2. View Provider Pattern
```typescript
// Presenter coordinates between service and view
class LocalViewPresenter {
  constructor(
    private viewProviderService: ViewProviderService,
    private issuesService: IssuesService
  ) {}
}

// Provider handles VS Code tree view
class LocalViewTreeProvider implements vscode.TreeDataProvider<TreeNode>
```

### 3. Event-Driven Communication
```typescript
// Services emit events through listener patterns
interface ServiceWithListeners {
  addListener(listener: (data: T) => Promise<void>): void
  removeListener(listener: (data: T) => Promise<void>): void
}
```

### 4. Webview Coordination
```typescript
// Structured message-based communication
class WebviewCoordinator {
  private providers = new Map<WebviewType, WebviewProvider>();
  
  async openWebview<T>(type: WebviewType, data: T): Promise<void>
}
```

### 5. gRPC Client Abstraction
```typescript
// Service-specific clients with connection management
class ControllerClientService {
  createIssuesServiceClient(): IssuesServiceClient
  createAnalysisServiceClient(): AnalysisServiceClient
  // Other specialized clients...
}
```

## Code Conventions & Standards

### File Organization
- **Services**: End with `Service`/`ServiceImpl`
- **Views**: End with `Provider`/`Presenter`
- **Models**: Descriptive domain names (`NewIssue`, `EntitlementModel`)
- **Constants**: UPPER_SNAKE_CASE in dedicated files
- **Utils**: Grouped by functional domain

### TypeScript Patterns
- **Strict Mode**: Full strict type checking enabled
- **Interface Segregation**: Small, focused interfaces
- **Generic Service IDs**: Type-safe dependency injection
- **Async/Await**: Consistent Promise-based async patterns
- **Error Propagation**: Structured error handling with user notifications
- **Import Organization**: All imports must be at the top of the file. Never use inline imports like `import("...")` in type annotations; instead, add the type to the import statements at the top of the file

### VS Code Integration
- **Command Registration**: Declarative command definitions in package.json
- **Context Keys**: Feature flagging through VS Code contexts
- **Configuration**: Settings through VS Code configuration API
- **Tree Views**: Native VS Code tree providers
- **Webviews**: React components for complex UI

## Key Components & Services

### Core Services
- **`ExtensionService`** - Main extension lifecycle management
- **`AuthenticationService`** - Multi-product authentication (Polaris, Coverity, etc.)
- **`ScanService`** - Local and remote scanning orchestration
- **`IssuesService`** - Security issue management and filtering
- **`ConfigurationService`** - Extension and scan configuration
- **`TelemetryService`** - Usage analytics and monitoring

### View Providers
- **`LocalViewTreeProvider`** - Local scan results tree
- **`TeamViewTreeProvider`** - Remote scan results tree
- **`ExtensionStatusTreeProvider`** - Setup and status information
- **Various Webview Providers** - Authentication, configuration, licensing

### Controller Clients
- **`IssuesServiceClient`** - Security issue retrieval and management
- **`AnalysisServiceClient`** - Code analysis and scanning
- **`DiagnosticsServiceClient`** - System health and diagnostics
- **`UserServiceClient`** - User authentication and entitlements

## Common Development Tasks

### Adding New Services
1. Define service interface
2. Create implementation with static `id` property
3. Register in `ServiceContainer.initServices()`
4. Add dependency injection to consumers
5. Implement lifecycle methods if needed

### Creating View Providers
1. Extend appropriate base class (`WebviewProvider`, tree provider)
2. Create corresponding presenter for business logic
3. Register commands in package.json
4. Add to view provider service factory

### Adding gRPC Clients
1. Generate TypeScript definitions from proto files
2. Create service-specific client wrapper
3. Add to `ControllerClientService` factory
4. Implement connection management and error handling

### Implementing Webviews
1. Create React component in `webview-ui/`
2. Define message contracts in `webview-model/`
3. Create webview provider extending `WebviewProviderBase`
4. Register in webview coordinator

### Configuration Changes
1. Update `package.json` contributes.configuration
2. Add to `ConfigurationService` interface
3. Implement getter/setter methods
4. Add migration logic if needed

## Testing Strategy

### Test Structure
- **Unit Tests**: Service logic testing with mocking
- **Integration Tests**: Component interaction testing
- **Multi-Version Testing**: Compatibility across VS Code versions (1.91-1.100)
- **Workspace Tests**: Real workspace scenario testing

### Test Utilities
- **Mock Services**: Test implementations in `test-utils/`
- **Test Workspace**: Prepared workspace in `src/test-workspace/`
- **Service Container**: Separate test container for isolation

## Security Considerations

### Defensive Security Focus
- **Input Validation**: All user inputs validated and sanitized
- **API Authentication**: Secure token-based authentication
- **Certificate Validation**: Proper TLS certificate handling
- **Sensitive Data**: No secrets logged or exposed
- **Permission Model**: Minimal required permissions

### Data Handling
- **Personal Data**: Minimal collection, user consent
- **Telemetry**: Opt-in usage analytics
- **Local Storage**: Encrypted sensitive configuration
- **Network Communication**: TLS-only for all external communication

## Performance Optimization

### Scanning Performance
- **Incremental Scanning**: Only scan changed files
- **Background Processing**: Non-blocking scan execution
- **Result Caching**: Intelligent caching of scan results
- **Connection Pooling**: Efficient gRPC connection management

### UI Performance
- **Virtual Scrolling**: Large result sets handled efficiently
- **Lazy Loading**: On-demand data loading
- **Debounced Updates**: Reduced unnecessary re-renders
- **Memory Management**: Proper cleanup of resources

## Troubleshooting & Debugging

### Common Issues
- **Controller Connection**: Check controller binary extraction and ports
- **Authentication**: Verify server connectivity and credentials
- **Scanning**: Check workspace trust and file permissions
- **UI Responsiveness**: Monitor webview communication and state

### Debug Configuration
- **Logging**: Winston-based structured logging
- **Debug Mode**: Enhanced logging and diagnostics
- **Extension Host**: VS Code extension development host
- **Network Diagnostics**: gRPC connection monitoring

### Log Analysis
- **Log Levels**: ERROR, WARN, INFO, DEBUG, TRACE
- **Log Export**: Built-in log export functionality
- **Structured Data**: JSON-formatted log entries
- **Performance Metrics**: Scan timing and resource usage

## Extension Lifecycle

### Activation
1. Extension activated on workspace open (`*` activation event)  
2. Service container initialization
3. Controller binary extraction and startup
4. Authentication state restoration
5. View provider registration
6. Command registration and context setup

### Runtime Operations
- **Incremental Scanning**: File change detection and incremental scanning
- **Project Scanning**: User-initiated full workspace scans
- **Background Services**: Health monitoring, token refresh
- **State Synchronization**: Local and remote state coordination

### Deactivation
- **Graceful Shutdown**: Controller process termination
- **State Persistence**: Configuration and authentication state saving
- **Resource Cleanup**: Memory and file handle cleanup
- **Service Disposal**: Proper service lifecycle termination

## AI Development Guidelines

### Code Analysis Approach
- **Service Layer First**: Start with service interfaces and dependencies
- **View Layer Second**: Understand UI patterns and data flow
- **Model Layer Third**: Examine data structures and relationships
- **Integration Last**: Analyze cross-cutting concerns and integrations

### Common Modification Patterns
- **New Features**: Service → Model → View → Command registration
- **Bug Fixes**: Identify service layer issue, add tests, fix implementation
- **UI Changes**: Modify presenter logic, update view provider, test integration
- **Configuration**: Update schema, add migration, implement getters/setters

### Best Practices for AI Assistance
- **Type Safety**: Always maintain strict TypeScript typing
- **Error Handling**: Follow existing error propagation patterns
- **Testing**: Add appropriate test coverage for changes
- **Documentation**: Update inline documentation for significant changes
- **Security**: Never introduce vulnerabilities or expose sensitive data

---

*This document serves as a comprehensive reference for AI assistants working with the Code Sight VS Code extension codebase. It should be updated as the codebase evolves.* 