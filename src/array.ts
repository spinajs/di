import { Class } from "./types";

export class TypedArray<T> extends Array<T>{
    constructor(public Type: Class<T>) {
        super()
    }
}

// tslint:disable-next-line: only-arrow-functions
Array.prototype.ofType = function <T>(type: Class<T>) {
    return new TypedArray<T>(type);
}