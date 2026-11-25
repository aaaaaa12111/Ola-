"use strict";
/**
 * Security utilities for safely escaping shell commands and SQL queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeShellArg = escapeShellArg;
exports.escapeShellArgs = escapeShellArgs;
exports.escapeSQLString = escapeSQLString;
exports.escapeRubyHeredoc = escapeRubyHeredoc;
exports.isShellSafe = isShellSafe;
exports.sanitizeRailsName = sanitizeRailsName;
exports.escapeForDisplay = escapeForDisplay;
/**
 * Escape a shell argument for safe use in terminal commands
 * Prevents command injection by properly quoting and escaping special characters
 *
 * @param arg The argument to escape
 * @returns Safely escaped argument suitable for shell execution
 */
function escapeShellArg(arg) {
    if (!arg) {
        return '""';
    }
    // For Unix-like systems (macOS, Linux)
    // Use single quotes and escape any single quotes in the string
    // Single quotes preserve everything literally except single quotes themselves
    return `'${arg.replace(/'/g, "'\\''")}'`;
}
/**
 * Escape multiple shell arguments
 *
 * @param args Array of arguments to escape
 * @returns Space-separated escaped arguments
 */
function escapeShellArgs(args) {
    return args.map(escapeShellArg).join(' ');
}
/**
 * Escape a SQL string literal for safe interpolation
 * Note: This is a basic escape - prefer parameterized queries when possible
 *
 * @param value The value to escape
 * @returns Escaped SQL string literal
 */
function escapeSQLString(value) {
    if (!value) {
        return "''";
    }
    // Escape single quotes by doubling them (SQL standard)
    // Also escape backslashes to prevent escape sequence injection
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
/**
 * Escape a Ruby string literal for safe interpolation in heredocs
 * Used when embedding user input in Rails runner commands
 *
 * @param value The value to escape
 * @returns Escaped Ruby string suitable for heredoc
 */
function escapeRubyHeredoc(value) {
    if (!value) {
        return '';
    }
    // Escape backslashes and double quotes for Ruby string interpolation
    // This prevents breaking out of heredoc strings
    return value
        .replace(/\\/g, '\\\\') // Escape backslashes first
        .replace(/"/g, '\\"') // Escape double quotes
        .replace(/\${/g, '\\${') // Escape variable interpolation
        .replace(/`/g, '\\`') // Escape backticks (command substitution)
        .replace(/\$/g, '\\$'); // Escape $ for safety
}
/**
 * Validate that a string contains only safe characters for shell commands
 * Useful for additional validation before executing commands
 *
 * @param value The value to validate
 * @param allowedPattern Optional regex pattern for allowed characters
 * @returns True if the value is safe, false otherwise
 */
function isShellSafe(value, allowedPattern) {
    if (!value) {
        return true;
    }
    // Default: allow alphanumeric, underscore, hyphen, dot, slash
    const pattern = allowedPattern || /^[a-zA-Z0-9_\-./]+$/;
    return pattern.test(value);
}
/**
 * Sanitize input for Rails model/controller names
 * Ensures input follows Ruby naming conventions and is safe
 *
 * @param name The name to sanitize
 * @returns Sanitized name or null if invalid
 */
function sanitizeRailsName(name) {
    if (!name) {
        return null;
    }
    // Rails names should be CamelCase or snake_case
    // Only allow letters, numbers, and underscores
    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitized.length === 0) {
        return null;
    }
    // Ensure it doesn't start with a number (invalid Ruby identifier)
    if (/^[0-9]/.test(sanitized)) {
        return null;
    }
    return sanitized;
}
/**
 * Escape input for display in error messages
 * Prevents XSS-like issues in VSCode notifications
 *
 * @param value The value to escape for display
 * @returns Escaped value safe for display
 */
function escapeForDisplay(value) {
    if (!value) {
        return '';
    }
    // Truncate very long strings to prevent UI issues
    const maxLength = 100;
    let escaped = value;
    if (escaped.length > maxLength) {
        escaped = escaped.substring(0, maxLength) + '...';
    }
    // Remove control characters
    escaped = escaped.replace(/[\x00-\x1F\x7F]/g, '');
    return escaped;
}
//# sourceMappingURL=shellEscape.js.map