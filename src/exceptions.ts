/**
 * Exception thrown when cannot resolve type
 */
export class ResolveException extends Error {
    /**
     * Constructs new exception with message
     * @param message - error message
     */
    constructor(message?: string) {
        super(message);
    }
}
