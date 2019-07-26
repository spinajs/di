import { ResolveType } from "./enums";
import { Factory } from "./types";

/**
 * Interface to describe DI binding behaviour
 */
export interface IBind {
    /**
     * `as` binding (alias)
     *
     * @param type - base class that is being registered
     */
    as<T>(type: Class<T>) :void;

    /**
     * self bind, class should be resolved by its name. Its default behaviour.
     */
    asSelf() : void;
}

export interface IContainer{
    Cache : Map<string, any[] | any>;
    Registry : Map<Class<any>, any[] | any>;
    Strategies : IStrategy[];

    clear() : void;
    register<T>(implementation: Class<T>): IBind;
    child(): IContainer; 
    get<T = {}>(service: string | Class<T>, parent? : boolean): T;
    has<T>(service: string | Class<T>, parent? : boolean): boolean
    resolve<T>(type: Class<T> | Factory<T> | T, options?: any[]): T extends T[] ? T[] | Promise<T[]> : Promise<T> | T
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
 * Internally its used to initialize all framework internal modules.
 *
 * @see FrameworkModuleResolveStrategy implementation
 */
export interface IStrategy {
    resolve: (target: any, container: IContainer) => Promise<void> | void;
}
