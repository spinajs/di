import { IContainer } from "./interfaces";

/**
 * Abstract class type
 */
// tslint:disable-next-line: ban-types
 
export type Factory<T> = (container: IContainer, ...args: any[]) => T;
export type ClassArray<T> = Array<Class<T>>;
 