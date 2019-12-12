import { ResolveType } from "./enums";
import { Class, Factory } from "./types";

/**
 * Interface to describe DI binding behaviour
 */
export interface IBind {
    /**
     * `as` binding (alias)
     *
     * @param type - base class that is being registered
     */
    as<T>(type: Class<T>): void;

    /**
     * self bind, class should be resolved by its name. Its default behaviour.
     */
    asSelf(): void;
}

export interface IContainer {
    Cache: Map<string, any[] | any>;
    Registry: Map<Class<any>, any[] | any>;

    clear(): void;
    register<T>(implementation: Class<T> | Factory<T>): IBind;
    child(): IContainer;
    get<T = {}>(service: string | Class<T>, parent?: boolean): T;
    has<T>(service: string | Class<T>, parent?: boolean): boolean;
    check<T>(service : Class<T>, parent? : boolean) : boolean;

    resolve<T>(type: Class<T> | Factory<T>, options?: any[]): T extends AsyncResolveStrategy ? Promise<T> : T;
    resolve<T>(type: TypedArray<T>, options?: any[]): T extends AsyncResolveStrategy ? Promise<T[]> : T[];
}

/**
 * Injection description definition structure
 */
export interface IInjectDescriptor<T = any> {
    inject: Array<IToInject<T>>;
    resolver: ResolveType;
}

export interface IToInject<T = any> {
    inject: Class<T>;
    autoinject: boolean;
    all: boolean;
    autoinjectKey: string;
}

export interface IResolvedInjection {
    instance: any;
    autoinject: boolean;
    autoinjectKey: string;
}

/**
 * Interface to describe DI resolve strategies. Strategies are used do
 * do some work at object creation eg. initialize objects that inherits from same class
 * specific way but without need for factory function.
 *
 *
 * @see FrameworkModuleResolveStrategy implementation
 */
// export interface IStrategy {
//     resolve: (target: any, container: IContainer) => void;
// }

// export interface IAsyncStrategy {
//     resolveA: (target: any, container: IContainer) => Promise<void>;
// }

export abstract class ResolveStrategy{
   public abstract resolve(container: IContainer): void;
}

export abstract class AsyncResolveStrategy{
    public abstract resolveAsync(container: IContainer): Promise<void>;
}
