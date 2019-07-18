type Abstract<T> = Function & { prototype: T };
type Constructor<T> = new (...args: any[]) => T;
type Class<T> = Abstract<T> | Constructor<T>;
 
declare class TypedArray<T> extends Array<T>{

    Type : Class<T>;

}

interface ArrayConstructor {
    ofType<T>(type: Class<T>): TypedArray<T>;
}
 