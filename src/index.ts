import { ArgumentException } from "@spinajs/exceptions";
import * as _ from 'lodash';
import 'reflect-metadata';
import { isConstructor } from './helpers';

/**
 * Global symbol used as property key on class
 * that handle DI behaviour.
 */
export const DI_DESCRIPTION_SYMBOL = Symbol.for('DI_INJECTION_DESCRIPTOR');

/**
 * How to resolve class
 * @enum
 */
export enum ResolveType {
  /**
   * Application wise single instance. Default behaviour
   */
  Singleton,

  /**
   * New instance every time is requested
   */
  NewInstance,

  /**
   * New instance per child DI container.
   */
  PerChildContainer,
}

/**
 * Custom type to check if passed arg is Class (can be created via new())
 */
export type ServiceIdentifier = new (...args: any[]) => any;

/**
 * Custom type to check if passed arg is abstract class
 */
// tslint:disable-next-line: ban-types
export type AbstractServiceIdentifier = Function & { prototype: any };

/**
 * Custom type to check if passed arg is DI factory function ( is called to create new object )
 */
export type ServiceFactory = (container: Container, ...args: any[]) => any;

export type ServiceArray = AbstractServiceIdentifier[] | ServiceIdentifier[];

/**
 * Interface to describe DI binding behaviour
 */
export interface IBind {
  /**
   * `as` binding (alias)
   *
   * @param type - base class that is being registered
   */
  as: (type: ServiceIdentifier | AbstractServiceIdentifier) => void;

  /**
   * self bind, class should be resolved by its name. Its default behaviour.
   */
  asSelf: () => void;
}

/**
 * Injection description definition structure
 */
interface IInjectDescriptor {
  inject: IToInject[];
  resolver: ResolveType;
}

interface IToInject {
  inject: ServiceIdentifier;
  autoinject: boolean;
  all: boolean;
  autoinjectKey: string;
}

interface IResolvedInjection {
  instance: any;
  autoinject: boolean;
  autoinjectKey: string;
}

/**
 * Sets dependency injection guidelines - what to inject for specified class. If multiple instances are registered at specified type,
 * only first one is resolved and injected
 * @param args - what to inject - class definitions
 * @example
 * ```javascript
 *
 * @Inject(Bar)
 * class Foo{
 *
 *  @Inject(Bar)
 *  barInstance : Bar;
 *
 *  constructor(bar : Bar){
 *      // bar is injected when Foo is created via DI container
 *      this.barInstance = bar;
 *  }
 *
 *  someFunc(){
 *
 *    this._barInstance.doSmth();
 *  }
 * }
 *
 * ```
 */
export function Inject(...args: Array<ServiceIdentifier | AbstractServiceIdentifier>) {
  return injectable((descriptor: IInjectDescriptor) => {
    for (const a of args) {
      descriptor.inject.push({
        all: false,
        autoinject: false,
        autoinjectKey: '',
        inject: a as any,
      });
    }
  });
}


/**
 * Sets dependency injection guidelines - what to inject for specified class. If multiple instances are registered at specified type,
 * all of them are resolved and injected
 * @param args - what to inject - class definitions
 * @example
 * ```javascript
 *
 * @InjectAll(Bar)
 * class Foo{
 *
 *  barInstances : Bar[];
 *
 *  constructor(bars : Bar[]){
 *      // all Bar implementations are injected when Foo is created via DI container
 *      this.barInstances = bar;
 *  }
 * }
 *
 * ```
 */
export function InjectAll(...args: Array<ServiceIdentifier | AbstractServiceIdentifier>) {
  return injectable((descriptor: IInjectDescriptor) => {
    for (const a of args) {
      descriptor.inject.push({
        all: true,
        autoinject: false,
        autoinjectKey: '',
        inject: a as any,
      });
    }
  });
}

/**
 * Automatically injects dependency based on reflected property type. Uses experimental typescript reflection api
 * If decorator is applied to array property all registered type instances are injected, otherwise only first / only that exists
 * 
 * @param target
 * @param key
 * @example
 * ```javascript
 * class Foo{
 *
 *  @Autoinject
 *  barInstance : Bar;
 *
 *  constructor(){
 *      // ....
 *  }
 *
 *  someFunc(){
 *
 *    // automatically injected dependency is avaible now
 *    this.barInstance.doSmth();
 *  }
 * }
 *
 * ```
 */
export function Autoinject(injectType?: ServiceIdentifier | AbstractServiceIdentifier) {
  return injectable((descriptor: IInjectDescriptor, target: any, propertyKey: string) => {
    const type = Reflect.getMetadata('design:type', target, propertyKey);
    const isArray = type.name === 'Array';

    if (type.name === 'Array' && !injectType) {
      throw new Error("you must provide inject type when injecting array");
    }

    descriptor.inject.push({
      all: isArray ? true : false,
      autoinject: true,
      autoinjectKey: propertyKey,
      inject: isArray ? injectType : type,
    })
  });
}


/**
 * Lazy injects service to object. Use only with class properties
 *
 * @param ser vice - class or name of service to inject
 *
 * @example
 * ```javascript
 *
 * class Foo{
 * ...
 *
 *  @LazyInject(Bar)
 *  _barInstance : Bar; // _barInstance is not yet resolved
 *
 *  someFunc(){
 *    // barInstance is resolved only when first accessed
 *    this._barInstance.doSmth();
 *  }
 * }
 *
 * ```
 */
export function LazyInject(service: ServiceIdentifier | string) {
  return (target?: any, key?: string) => {
    // property getter
    const getter = () => {
      if (typeof service === "string") {
        return DI.get<any>(service);
      } else {
        return DI.resolve<any>(service);
      }
    };

    // Create new property with getter and setter
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: getter,
    });
  };
}

/**
 * Per child instance injection decorator - object is resolved once per container - child containers have own instances.
 */
export function PerChildInstance() {
  return injectable((descriptor: IInjectDescriptor) => {
    descriptor.resolver = ResolveType.PerChildContainer;
  });
}

/**
 * NewInstance injection decorator - every time class is injected - its created from scratch
 */
export function NewInstance() {
  return injectable((descriptor: IInjectDescriptor) => {
    descriptor.resolver = ResolveType.NewInstance;
  });
}

/**
 * Singleton injection decorator - every time class is resolved - its created only once globally ( even in child DI containers )
 */
export function Singleton() {
  return injectable();
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
export interface IResolveStrategy {
  resolve: (target: any, container: Container) => any;
}

function injectable(callback?: (descriptor: IInjectDescriptor, target: ArrayBuffer, propertyKey: string | symbol, indexOrDescriptor: number | PropertyDescriptor) => void): any {
  return (target: any, propertyKey: string | symbol, indexOrDescriptor: number | PropertyDescriptor) => {
    let descriptor: IInjectDescriptor = target[DI_DESCRIPTION_SYMBOL];
    if (!descriptor) {
      descriptor = {
        inject: [],
        resolver: ResolveType.Singleton
      };

      target[DI_DESCRIPTION_SYMBOL] = descriptor;
    }

    if (callback) {
      callback(descriptor, target, propertyKey, indexOrDescriptor);
    }
  }
}

/**
 * Dependency injection container implementation
 */
export class Container {
  /**
   * Handles information about what is registered as what
   * eg. that class IConfiguration should be resolved as DatabaseConfiguration etc.
   * @access private
   */
  private registry: Map<ServiceIdentifier | AbstractServiceIdentifier, any[]>;

  /**
   * Singletons cache, objects that should be created only once are stored here.
   * @access private
   */
  private cache: Map<string, any[]>;

  /**
   * Resolve strategy array.
   */
  private strategies: IResolveStrategy[] = [];

  /**
   * Parent container if avaible
   */
  private parent: Container = undefined;

  /**
   * Returns container cache - map object with resolved classes as singletons
   */
  public get Cache() {
    return this.cache;
  }

  public get ResolveStrategies(): IResolveStrategy[] {
    return this.strategies;
  }

  public get Registry(): Map<ServiceIdentifier | AbstractServiceIdentifier, any[]> {
    return this.registry;
  }

  constructor(parent?: Container) {
    this.registry = new Map<ServiceIdentifier | AbstractServiceIdentifier, any[]>();
    this.cache = new Map<string, any[]>();

    if (parent) {
      this.strategies = parent.ResolveStrategies.slice(0);
    }

    this.parent = parent;
  }

  /**
   * Clears container registry and cache.
   */
  public clear() {
    this.cache.clear();
    this.registry.clear();
  }

  /**
   * Register class/interface to DI.
   * @param type - interface object to register
   * @throws { ArgumentException } if type is null or undefined
   */
  public register(implementation: ServiceIdentifier | ServiceFactory): IBind {
    if (_.isNil(implementation)) {
      throw new ArgumentException('argument `type` cannot be null or undefined');
    }

    const self = this;

    return {
      as: (type: ServiceIdentifier | AbstractServiceIdentifier) => {
        if (self.registry.has(type)) {
          (self.registry.get(type) as any[]).push(implementation);
        } else {

          const arr: any[] = [];
          arr.push(implementation);

          self.registry.set(type, arr);
        }
      },
      asSelf: () => {
        const arr: any[] = [];
        arr.push(implementation);

        self.registry.set(implementation, arr);
        return this;
      }
    };
  }

  /**
   * Creates child DI container.
   *
   */
  public child(): Container {
    return new Container(this);
  }

  /**
   * Gets already resolved service. Works only for singleton classes.
   *
   * @param serviceName - name of service to get
   * @returns { null | T} - null if no service has been resolved at given name
   */
  public get(service: string | ServiceIdentifier | AbstractServiceIdentifier, parent = true): any {
    const identifier = typeof service === 'string' ? service : service.constructor.name;

    if (this.cache.has(identifier)) {
      return this.cache.get(identifier);
    } else if (this.parent && parent) {
      return this.parent.get(service);
    }

    return null;
  }

  /**
   * Checks if service is already resolved and exists in container cache.
   * NOTE: check is only valid for classes that are singletons.
   *
   * @param service - service name or class to check
   * @returns { boolean } - true if service instance already exists, otherwise false.
   * @throws { ArgumentException } when service is null or empty
   */
  public has(service: string | ServiceIdentifier | AbstractServiceIdentifier, parent = true): boolean {
    if (!service) {
      throw new ArgumentException('argument cannot be null or empty');
    }

    const name = _.isString(service) ? service : service.constructor.name;

    if (this.cache.has(name)) {
      return true;
    }

    if (this.parent && parent) {
      return this.parent.has(name);
    }

    return false;
  }

  public async resolve<T>(type: ServiceIdentifier | ServiceFactory | AbstractServiceIdentifier, options?: any[]): Promise<T> {
    return (await this.resolveAll<T>(type, options))[0];
  }

  /**
   * Resolves specified type.
   *
   * @param type { ServiceIdentifier | ServiceFactory } - class to resolve or service factory function
   * @param options - optional parameters passed to class constructor
   * @return - class instance
   * @throws { ArgumentException } if type is null or undefined
   */
  public async resolveAll<T>(type: ServiceIdentifier | ServiceFactory | AbstractServiceIdentifier, options?: any[]): Promise<T[]> {
    const self = this;
    const instances: any[] = [];

    if (_.isNil(type)) {
      throw new ArgumentException('argument `type` cannot be null or undefined');
    }

    const targets = this.registry.has(type as ServiceIdentifier) ? this.registry.get(type as ServiceIdentifier) : [type];

    for (const target of targets) {
      let instance = null;
      /**
       * Double cast to remove typescript errors, we are sure that needed properties are in class definition
       */
      const descriptor = (
        ((target as any)[DI_DESCRIPTION_SYMBOL] || (target.prototype && (((target as any).prototype)[DI_DESCRIPTION_SYMBOL])) || { inject: [], resolver: ResolveType.Singleton })
      ) as IInjectDescriptor;

      const toInject: IResolvedInjection[] = await Promise.all(
        descriptor.inject.map(async t => {
          return {
            autoinject: t.autoinject,
            autoinjectKey: t.autoinjectKey,
            instance: (t.all) ? await this.resolveAll(t.inject) : await this.resolve(t.inject),
          };
        }),
      );

      const cacheKey = _.isFunction(target) ? type : target;
      switch (descriptor.resolver) {
        case ResolveType.NewInstance:
          instance = await _getNewInstance(target, toInject);
          break;
        case ResolveType.Singleton:
          instance = _getCachedInstance(cacheKey, true) || (await _getNewInstance(target, toInject));
          break;
        case ResolveType.PerChildContainer:
          instance = _getCachedInstance(cacheKey, false) || (await _getNewInstance(target, toInject));
          break;
      }

      if (descriptor.resolver === ResolveType.PerChildContainer || descriptor.resolver === ResolveType.Singleton) {
        if (!self.cache.has(cacheKey.name)) {
          self.cache.set(cacheKey.name, instance);
        }
      }

      instances.push(instance);
    }

    return instances;

    function _getCachedInstance(e: any, parent: boolean): any {
      if (self.has(e.name, parent)) {
        return self.get(e.name, parent);
      }

      return null;
    }

    async function _getNewInstance(typeToCreate: any, a?: IResolvedInjection[]): Promise<any[]> {
      let args: any[] = [null];
      let newInstance: any = null;

      /**
       * If type is not Constructable, we assume its factory function,
       * just call it with `this` container.
       */
      if (!isConstructor(typeToCreate) && _.isFunction(typeToCreate)) {
        newInstance = (typeToCreate as ServiceFactory)(self, ...[].concat(options));
      }
      else {
        if (_.isArray(a)) {
          args = args.concat(a.filter(i => !i.autoinject).map(i => i.instance));
        }

        if (!_.isEmpty(options)) {
          args = args.concat(options);
        }

        newInstance = new (Function.prototype.bind.apply(typeToCreate, args))();

        for (const ai of a.filter(i => i.autoinject)) {
          newInstance[ai.autoinjectKey] = ai.instance;
        }

        await Promise.all(self.strategies.map(s => s.resolve(newInstance, self)));
      }

      return newInstance;
    }
  }
}

// tslint:disable-next-line: no-namespace
export namespace DI {
  /**
   * App main DI container
   */
  export const RootContainer = new Container();

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
  export function register(type: ServiceIdentifier | ServiceFactory): IBind {
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
  export async function resolve<T>(type: ServiceIdentifier | ServiceFactory | AbstractServiceIdentifier, options?: any[]): Promise<T> {
    return RootContainer.resolve<T>(type, options);
  }

  /**
   * Gets already resolved service from root container.
   *
   * @param serviceName - name of service to get
   * @returns { null | T} - null if no service has been resolved at given name
   */
  export function get<T>(serviceName: string | ServiceIdentifier | AbstractServiceIdentifier): T {
    return RootContainer.get(serviceName) as T;
  }

  /**
   * Checks if service is already resolved and exists in container cache.
   * NOTE: check is only valid for classes that are singletons.
   *
   * @param service - service name or class to check
   * @returns { boolean } - true if service instance already exists, otherwise false.
   */
  export function has(service: string | ServiceIdentifier | AbstractServiceIdentifier): boolean {
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
