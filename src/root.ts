import { Container } from "./container";
import { IBind } from "./interfaces";
import { FrameworkModuleResolveStrategy } from "./strategies";
import { Factory } from "./types";

// tslint:disable-next-line: no-namespace
export namespace DI {
    /**
     * App main DI container
     */
    export const RootContainer = new Container();

    // add modules resolve strategy to proper init
    RootContainer.ResolveStrategies.push(new FrameworkModuleResolveStrategy());

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
    export function register<T>(type: Constructor<T> | Factory<T>): IBind {
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
    export async function resolve<T>(type: Class<T> | Factory<T>, options?: any[]): Promise<T> {
        return RootContainer.resolve<T>(type, options);
    }

    /**
     * Gets already resolved service from root container.
     *
     * @param serviceName - name of service to get
     * @returns { null | T} - null if no service has been resolved at given name
     */
    export function get<T>(serviceName: string | Class<T>): T {
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
     * Creates child DI container.
     *
     */
    export function child(): Container {
        return RootContainer.child();
    }
}
