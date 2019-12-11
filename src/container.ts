import { ArgumentException } from "@spinajs/exceptions";
import * as _ from 'lodash';
import 'reflect-metadata';
import { TypedArray } from './array';
import { DI_DESCRIPTION_SYMBOL } from "./decorators";
import { ResolveType } from "./enums";
import { isConstructor } from './helpers';
import { IBind, IContainer, IInjectDescriptor, IResolvedInjection, ResolveStrategy, IToInject, AsyncResolveStrategy } from './interfaces';
import { Class, Factory } from './types';

/**
 * Dependency injection container implementation
 */
export class Container implements IContainer {
  /**
   * Handles information about what is registered as what
   * eg. that class IConfiguration should be resolved as DatabaseConfiguration etc.
   * @access private
   */
  private registry: Map<Class<any>, Array<Class<any>>>;

  /**
   * Singletons cache, objects that should be created only once are stored here.
   * @access private
   */
  private cache: Map<string, any[] | any>;

  /**
   * Parent container if avaible
   */
  private parent: IContainer;

  /**
   * Returns container cache - map object with resolved classes as singletons
   */
  public get Cache() {
    return this.cache;
  }


  public get Registry(): Map<Class<any>, Array<Class<any>>> {
    return this.registry;
  }

  constructor(parent?: IContainer) {
    this.registry = new Map<Class<any>, any[]>();
    this.cache = new Map<string, any[]>();
    this.parent = parent || undefined;

    this.registerSelf();
  }

  /**
   * Clears container registry and cache.
   */
  public clear() {
    this.cache.clear();
    this.cache = new Map<string, any[]>();
    this.registry.clear();

    this.registerSelf();
  }

  /**
   * Register class/interface to DI.
   * @param type - interface object to register
   * @throws { ArgumentException } if type is null or undefined
   */
  public register<T>(implementation: Class<T> | Factory<T>): IBind {
    if (_.isNil(implementation)) {
      throw new ArgumentException('argument `type` cannot be null or undefined');
    }

    const self = this;

    return {
      as(type: Class<T>) {
        if (self.registry.has(type)) {
          self.registry.get(type).push(implementation);
        } else {
          self.registry.set(type, [implementation]);
        }
      },
      asSelf() {
        self.registry.set(implementation, [implementation]);
        return this;
      }
    };
  }

  /**
   * Creates child DI container.
   *
   */
  public child(): IContainer {
    return new Container(this);
  }

  /**
   * Gets already resolved services. Works only for singleton classes.
   *
   * @param serviceName - name of service to get
   * @returns { null | T} - null if no service has been resolved at given name
   */
  public get<T = {}>(service: string | Class<T>, parent = true): T {
    const identifier = typeof service === 'string' ? service : service.constructor.name;

    if (this.cache.has(identifier)) {
      return this.cache.get(identifier);
    } else if (this.parent && parent) {
      return this.parent.get(service, parent);
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
  public has<T>(service: string | Class<T>, parent = true): boolean {
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

  /**
   * 
   * Resolves single instance of class
   * 
   * @param type what to resolve, can be class definition or factory function
   * @param options options passed to constructor / factory
   */
  public resolve<T>(type: Class<T> | Factory<T>, options?: any[]): T extends AsyncResolveStrategy ? Promise<T> : T;

  /**
   * 
   * Resolves all instances of given class. Under single definition can be registered multiple implementations.
   * 
   * @param type typed array of specified type. since TS does not expose array metadata and type its uses TypedArray<T> consctruct
   * @param options options passed to constructor / factory
   */
  public resolve<T>(type: TypedArray<T>, options?: any[]): T extends AsyncResolveStrategy ? Promise<T[]> : T[];
  public resolve<T>(type: Class<T> | Factory<T> | TypedArray<T>, options?: any[]): Promise<T | T[]> | T | T[] {

    if (_.isNil(type)) {
      throw new ArgumentException('argument `type` cannot be null or undefined');
    }

    const targetType = (type instanceof TypedArray) ? this.registry.get(type.Type) || [type.Type] : this.registry.get(type) || [type];
    const sourceType = (type instanceof TypedArray) ? type.Type : type;

    if (type instanceof TypedArray) {
      const resolved = targetType.map(r => this.resolveType(r, r, options));
      if (resolved.some(r => r instanceof Promise)) {
        return Promise.all(resolved) as Promise<T[]>;
      }

      return resolved as T[];
    }

    return this.resolveType(targetType[0], sourceType, options);
  }

  private resolveType<T>(type: Class<T> | Factory<T>, cacheKey: Class<T>, options?: any[]): Promise<T> | T {
    const self = this;
    const descriptor = _extractDescriptor<T>(type);
    const deps = _resolveDeps(descriptor.inject);

    if (deps instanceof Promise) {
      return deps.then(resolvedDependencies => {
        return _resolve(descriptor, type, resolvedDependencies);
      }).then(_setCache);
    } else {
      const resInstance = _resolve(descriptor, type, deps as IResolvedInjection[]);
      if (resInstance instanceof Promise) {
        return resInstance.then(_setCache);
      }

      _setCache(resInstance);
      return resInstance;
    }



    function _setCache(r: any) {
      if (descriptor.resolver === ResolveType.Singleton) {
        if (!self.has(type, true)) {
          self.Cache.set(cacheKey.name, r);
        }
      } else if (descriptor.resolver === ResolveType.PerChildContainer) {
        if (!self.has(type, false)) {
          self.Cache.set(cacheKey.name, r);
        }
      }
      return r;
    }

    function _resolve(d: IInjectDescriptor, t: Class<T> | Factory<T>, i: IResolvedInjection[]) {
      switch (d.resolver) {
        case ResolveType.NewInstance:
          return _getNewInstance(t, i);
        case ResolveType.Singleton:
          return _getCachedInstance(cacheKey, true) || _getNewInstance(t, i);
        case ResolveType.PerChildContainer:
          return _getCachedInstance(cacheKey, false) || _getNewInstance(t, i);
      }
    }

    function _extractDescriptor<T>(type: Abstract<T> | Constructor<T> | Factory<T>) {
      return (((type as any)[DI_DESCRIPTION_SYMBOL] || (type.prototype && (((type as any).prototype)[DI_DESCRIPTION_SYMBOL])) || { inject: [], resolver: ResolveType.Singleton })) as IInjectDescriptor;
    }

    function _resolveDeps(toInject: IToInject[]) {
      const dependencies = toInject.map(t => {
        const promiseOrVal = self.resolve(t.inject);
        if (promiseOrVal instanceof Promise) {
          return new Promise((res, _) => {
            res(promiseOrVal)
          }).then((val: any) => {
            return {
              autoinject: t.autoinject,
              autoinjectKey: t.autoinjectKey,
              instance: val
            };
          })
        }
        return {
          autoinject: t.autoinject,
          autoinjectKey: t.autoinjectKey,
          instance: promiseOrVal
        };;
      });

      if (dependencies.some(p => p instanceof Promise)) {
        return Promise.all(dependencies);
      }

      return dependencies;
    }

    function _getCachedInstance(e: any, parent: boolean): any {
      if (self.has(e.name, parent)) {
        return self.get(e.name, parent);
      }

      return null;
    }

    function _getNewInstance(typeToCreate: any, a?: IResolvedInjection[]): Promise<any> {
      let args: any[] = [null];
      let newInstance: any = null;

      /**
       * If type is not Constructable, we assume its factory function,
       * just call it with `this` container.
       */
      if (!isConstructor(typeToCreate) && _.isFunction(typeToCreate)) {
        newInstance = (typeToCreate as Factory<any>)(self, ...[].concat(options));
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

        if (newInstance instanceof AsyncResolveStrategy) {
          return new Promise((res) => {
            newInstance.resolveAsync(self).then(() => {
              res(newInstance);
            });
          });
        }

        if (newInstance instanceof ResolveStrategy) {
          newInstance.resolve(self);
        }
      }

      return newInstance;
    }
  }



  //  

  // allows container instance to be resolved
  private registerSelf() {
    this.cache.set("Container", this);
  }
}
