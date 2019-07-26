// tslint:disable-next-line: no-reference
/// <reference path="./../typings/array.d.ts" />

import { Class } from "./types";

export class TypedArray<T> extends Array<T>{
    constructor(public Type: Class<T>) {
        super()
    }
}

// tslint:disable-next-line: only-arrow-functions
Array.ofType = function <T>(type: Class<T>) {
    return new TypedArray<T>(type);
}
 