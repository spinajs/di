import { Container } from "./container";
import { IBind, IContainer, AsyncResolveStrategy } from "./interfaces";
import { Class, Factory } from "./types";

// tslint:disable-next-line: no-namespace
export namespace DI {
    /**
     * App main DI container
     */
    export const RootContainer: IContainer = new Container();

    /**
     * Clears root container registry and cache.
     */
    export function clear() {
        RootContainer.clear();
    }

    /**
     * Register class/interface to DI root container.
     * @param type - interface object to register
     * @throws { ArgumentException } if type is null or undefined
     */
    export function register<T>(type: Class<T> | Factory<T>): IBind {
        return RootContainer.register(type);
    }

    /**
     * Resolves specified type from root container.
     *
     * @param type - class to resolve
     * @param options - optional parameters passed to class constructor
     * @return - class instance
     * @throws { ArgumentException } if type is null or undefined
     */
    export function resolve<T>(type: string, options?: any[], check?: boolean): T;
    export function resolve<T>(type: string, check?: boolean): T;
    export function resolve<T>(type: Class<T>, check?: boolean): T extends AsyncResolveStrategy ? Promise<T> : T;
    export function resolve<T>(type: TypedArray<T>, check?: boolean): T extends AsyncResolveStrategy ? Promise<T[]> : T[];
    export function resolve<T>(type: Class<T>, options?: any[] | boolean, check?: boolean): T extends AsyncResolveStrategy ? Promise<T> : T;
    export function resolve<T>(type: TypedArray<T>, options?: any[] | boolean, check?: boolean): T extends AsyncResolveStrategy ? Promise<T[]> : T[];
    export function resolve<T>(type: Class<T> | TypedArray<T> | string, options?: any[] | boolean, check?: boolean): Promise<T | T[]> | T | T[] {
        return RootContainer.resolve<T>(type as any, options, check);
    }

    /**
     * Gets already resolved service from root container.
     *
     * @param serviceName - name of service to get
     * @returns { null | T} - null if no service has been resolved at given name
     */
    export function get<T>(serviceName: TypedArray<T>): T[];
    export function get<T>(serviceName: string | Class<T>): T;
    export function get<T>(serviceName: string | Class<T> | TypedArray<T>): T | T[] {
        return RootContainer.get(serviceName) as T;
    }

    /**
     * Checks if service is already resolved and exists in container cache.
     * NOTE: check is only valid for classes that are singletons.
     *
     * @param service - service name or class to check
     * @returns { boolean } - true if service instance already exists, otherwise false.
     */
    export function has<T>(service: string | Class<T>): boolean {
        return RootContainer.has(service);
    }

    /**
     * Checks if service is registered in container.
     * 
     * @param service service class object to check
     */
    export function check<T>(service: Class<T> | string): boolean {
        return RootContainer.hasRegistered(service);
    }
    /**
     * Creates child DI container.
     *
     */
    export function child(): IContainer {
        return RootContainer.child();
    }
}
