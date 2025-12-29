/**
 * Type definitions for HOFOR Scraper Addon
 */
/**
 * Custom error class for scraper errors
 */
export class ScraperError extends Error {
    code;
    retryable;
    constructor(message, code, retryable = false) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.name = 'ScraperError';
    }
}
/**
 * Custom error class for MQTT errors
 */
export class MqttError extends Error {
    code;
    retryable;
    constructor(message, code, retryable = false) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.name = 'MqttError';
    }
}
//# sourceMappingURL=types.js.map