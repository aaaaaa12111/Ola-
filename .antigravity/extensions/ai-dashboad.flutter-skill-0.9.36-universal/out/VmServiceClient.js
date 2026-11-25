"use strict";
/**
 * VM Service Protocol Client for Flutter Skill
 *
 * Connects to Flutter VM Service via WebSocket and provides
 * high-level methods for interacting with the running Flutter app.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VmServiceClient = void 0;
const WebSocket = require("ws");
class VmServiceClient {
    constructor(uri) {
        this.uri = uri;
        this.ws = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.isolateId = null;
    }
    /**
     * Connect to VM Service
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.uri);
                this.ws.on('open', async () => {
                    try {
                        // Get main isolate ID
                        await this.initializeIsolate();
                        resolve();
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                this.ws.on('message', (data) => {
                    try {
                        const response = JSON.parse(data.toString());
                        this.handleResponse(response);
                    }
                    catch (error) {
                        console.error('Failed to parse VM service response:', error);
                    }
                });
                this.ws.on('error', (error) => {
                    reject(error);
                });
                this.ws.on('close', () => {
                    this.ws = null;
                    this.isolateId = null;
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Disconnect from VM Service
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isolateId = null;
    }
    /**
     * Initialize and get main isolate ID
     */
    async initializeIsolate() {
        const vm = await this.callMethod('getVM', {});
        if (vm.isolates && vm.isolates.length > 0) {
            // Get the first running isolate
            this.isolateId = vm.isolates[0].id;
        }
        else {
            throw new Error('No isolates found');
        }
    }
    /**
     * Call a VM Service method
     */
    async callMethod(method, params) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to VM Service');
        }
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const request = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };
            this.pendingRequests.set(id, { resolve, reject });
            this.ws.send(JSON.stringify(request));
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 10000);
        });
    }
    /**
     * Handle response from VM Service
     */
    handleResponse(response) {
        const { id, result, error } = response;
        if (id && this.pendingRequests.has(id)) {
            const { resolve, reject } = this.pendingRequests.get(id);
            this.pendingRequests.delete(id);
            if (error) {
                reject(new Error(error.message || 'VM Service error'));
            }
            else {
                resolve(result);
            }
        }
    }
    /**
     * Call a service extension
     */
    async callExtension(extension, params = {}) {
        if (!this.isolateId) {
            throw new Error('No isolate initialized');
        }
        const result = await this.callMethod('ext.' + extension, {
            isolateId: this.isolateId,
            ...params
        });
        // Parse the response value (it's JSON-encoded)
        if (result && result.value) {
            return JSON.parse(result.value);
        }
        return result;
    }
    /**
     * Get interactive UI elements from Flutter app
     */
    async getInteractiveElements() {
        try {
            const response = await this.callExtension('flutter.flutter_skill.interactive');
            if (response.type === 'Success' && response.elements) {
                return response.elements.map((el) => ({
                    key: el.key || '',
                    type: el.type || '',
                    text: el.text,
                    hint: el.hint,
                    value: el.value,
                    position: el.position ? { x: el.position.x, y: el.position.y } : undefined,
                    size: el.size ? { width: el.size.width, height: el.size.height } : undefined,
                    enabled: el.enabled !== false,
                    visible: el.visible !== false
                }));
            }
            return [];
        }
        catch (error) {
            console.error('Failed to get interactive elements:', error);
            return [];
        }
    }
    /**
     * Tap an element
     */
    async tap(key) {
        try {
            const response = await this.callExtension('flutter.flutter_skill.tap', {
                key
            });
            return {
                success: response.success === true,
                data: response,
                error: response.success === false ? response.error : undefined
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'TAP_FAILED',
                    message: error.message || 'Failed to tap element'
                }
            };
        }
    }
    /**
     * Enter text into an element
     */
    async enterText(key, text) {
        try {
            const response = await this.callExtension('flutter.flutter_skill.enterText', {
                key,
                text
            });
            return {
                success: response.success === true,
                data: response,
                error: response.success === false ? response.error : undefined
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'INPUT_FAILED',
                    message: error.message || 'Failed to enter text'
                }
            };
        }
    }
    /**
     * Take a screenshot
     */
    async screenshot(quality = 1.0, maxWidth) {
        try {
            const params = { quality: quality.toString() };
            if (maxWidth) {
                params.maxWidth = maxWidth.toString();
            }
            const response = await this.callExtension('flutter.flutter_skill.screenshot', params);
            return response.image || null;
        }
        catch (error) {
            console.error('Failed to take screenshot:', error);
            return null;
        }
    }
    /**
     * Take screenshot of a specific element
     */
    async screenshotElement(key) {
        try {
            const response = await this.callExtension('flutter.flutter_skill.screenshotElement', {
                key
            });
            return response.image || null;
        }
        catch (error) {
            console.error('Failed to take element screenshot:', error);
            return null;
        }
    }
    /**
     * Trigger hot reload
     */
    async hotReload() {
        try {
            if (!this.isolateId) {
                throw new Error('No isolate initialized');
            }
            // Call the standard VM Service reloadSources method
            const response = await this.callMethod('reloadSources', {
                isolateId: this.isolateId,
                force: false,
                pause: false
            });
            return {
                success: true,
                data: response
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'HOT_RELOAD_FAILED',
                    message: error.message || 'Failed to hot reload'
                }
            };
        }
    }
    /**
     * Scroll to an element
     */
    async scroll(key) {
        try {
            const response = await this.callExtension('flutter.flutter_skill.scroll', {
                key
            });
            return {
                success: response.success === true,
                data: response
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'SCROLL_FAILED',
                    message: error.message || 'Failed to scroll'
                }
            };
        }
    }
    /**
     * Long press an element
     */
    async longPress(key, duration = 500) {
        try {
            const response = await this.callExtension('flutter.flutter_skill.longPress', {
                key,
                duration: duration.toString()
            });
            return {
                success: response.success === true,
                data: response
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'LONG_PRESS_FAILED',
                    message: error.message || 'Failed to long press'
                }
            };
        }
    }
    /**
     * Swipe in a direction
     */
    async swipe(direction, distance = 300) {
        try {
            const response = await this.callExtension('flutter.flutter_skill.swipe', {
                direction,
                distance: distance.toString()
            });
            return {
                success: response.success === true,
                data: response
            };
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'SWIPE_FAILED',
                    message: error.message || 'Failed to swipe'
                }
            };
        }
    }
    /**
     * Get widget tree
     */
    async getWidgetTree(maxDepth = 10) {
        try {
            const response = await this.callExtension('flutter.flutter_skill.getWidgetTree', {
                maxDepth: maxDepth.toString()
            });
            return response.tree || null;
        }
        catch (error) {
            console.error('Failed to get widget tree:', error);
            return null;
        }
    }
}
exports.VmServiceClient = VmServiceClient;
//# sourceMappingURL=VmServiceClient.js.map