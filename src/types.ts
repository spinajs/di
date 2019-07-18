
/**
 * Abstract class type
 */
// tslint:disable-next-line: ban-types
export type Abstract<T> = Function & { prototype: T };
export type Constructor<T> = new (...args: any[]) => T;
export type Class<T> = Abstract<T> | Constructor<T>;
export type Factory<T> = (container: Container, ...args: any[]) => T;
export type ClassArray<T> = Array<Class<T>>;
 