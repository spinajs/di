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
  private registry: Map<string, Array<Class<any>>>;

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


  public get Registry(): Map<string, Array<Class<any>>> {
    return this.registry;
  }

  constructor(parent?: IContainer) {
    this.registry = new Map<string, any[]>();
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
      as(type: Class<T> | string) {
        const tname = (typeof type === "string") ? type : type.name;
        if (self.registry.has(tname)) {
          self.registry.get(tname).push(implementation);
        } else {
          self.registry.set(tname, [implementation]);
        }
      },
      asSelf() {
        self.registry.set(implementation.name, [implementation]);
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
  public get<T>(service: TypedArray<T>, parent?: boolean): T[];
  public get<T>(service: string | Class<T>, parent?: boolean): T;
  public get<T>(service: string | Class<T> | TypedArray<T>, parent = true): T | T[] {

    const self = this;
    const identifier = (typeof service === 'string') ? service : (service instanceof TypedArray) ? this.Registry.get(service.Type.name) : this.Registry.get(service.name);

    if (typeof identifier === 'string') {
      return _get(identifier);
    }

    if (service instanceof TypedArray) {
      return (identifier as Array<Class<T>>).map(t => _get(t.name));
    }

    return _get(identifier[0].name);

    function _get(i: string) {
      if (self.cache.has(i)) {
        return self.cache.get(i);
      } else if (self.parent && parent) {
        return self.parent.get(i, parent);
      }

      return null;
    }
  }

  public check<T>(service: Class<T> | string, parent = true): boolean {

    if (this.registry.has((typeof service === "string") ? service : service.name)) {
      return true;
    } else if (this.parent && parent) {
      return this.parent.check(service);
    }

    return false;
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
  public resolve<T>(type: string, options?: any[], check?: boolean): T;
  public resolve<T>(type: string, check?: boolean): T;

  /**
   * 
   * Resolves single instance of class
   * 
   * @param type what to resolve, can be class definition or factory function
   * @param options options passed to constructor / factory
   */
  public resolve<T>(type: Class<T>, options?: any[], check?: boolean): T extends AsyncResolveStrategy ? Promise<T> : T;
  public resolve<T>(type: Class<T>, check?: boolean): T extends AsyncResolveStrategy ? Promise<T> : T;

  /**
   * 
   * Resolves all instances of given class. Under single definition can be registered multiple implementations.
   * 
   * @param type typed array of specified type. since TS does not expose array metadata and type its uses TypedArray<T> consctruct
   * @param options options passed to constructor / factory
   * @param check - strict check if serivice is registered in container before resolving. Default behavior is to not check and resolve
   * 
   */
  public resolve<T>(type: TypedArray<T>, options?: any[], check?: boolean): T extends AsyncResolveStrategy ? Promise<T[]> : T[];
  public resolve<T>(type: TypedArray<T>, check?: boolean): T extends AsyncResolveStrategy ? Promise<T[]> : T[];

  /**
   * 
   * @param type type to resolve
   * @param options options passed to constructor / factory
   * @param check strict check if serivice is registered in container before resolving. Default behavior is to not check and resolve
   */
  public resolve<T>(type: Class<T> | TypedArray<T> | string, options?: any[] | boolean, check?: boolean): Promise<T | T[]> | T | T[] {

    if (_.isNil(type)) {
      throw new ArgumentException('argument `type` cannot be null or undefined');
    }

    const opt = (typeof options === "boolean") ? null : options;
    const targetType = (type instanceof TypedArray) ? this.registry.get(type.Type.name) || [type.Type] : ((typeof type === 'string') ? this.registry.get(type) : this.registry.get(type.name) || [type]);
    const sourceType = (type instanceof TypedArray) ? type.Type : type;

    if (!targetType) {
      throw new Error(`cannot resolve type ${type} becouse is not registered in container`);
    }

    if (typeof options === "boolean" && options === true || check === true) {
      if (!this.Registry.has((typeof sourceType === 'string') ? sourceType : sourceType.name)) {
        throw new Error(`Type ${sourceType} is not registered at container`);
      }
    }

    if (typeof sourceType === 'string') {
      return this.resolveType(sourceType, targetType[0], sourceType, opt);
    }

    if (type instanceof TypedArray) {
      const resolved = targetType.map(r => this.resolveType(sourceType, r, r.name, opt));
      if (resolved.some(r => r instanceof Promise)) {
        return Promise.all(resolved) as Promise<T[]>;
      }

      return resolved as T[];
    }

    return this.resolveType(sourceType, targetType[0], sourceType.name, opt);
  }

  private resolveType<T>(sourceType: Class<T> | string, targetType: Class<T> | Factory<T>, cacheKey: string, options?: any[]): Promise<T> | T {
    const self = this;
    const descriptor = _extractDescriptor<T>(targetType);

    // check cache if needed
    if (descriptor.resolver === ResolveType.Singleton || descriptor.resolver === ResolveType.PerChildContainer) {
      if (this.has(targetType, descriptor.resolver === ResolveType.Singleton)) {
        return this.get(targetType);
      }
    }

    const deps = _resolveDeps(descriptor.inject);



    if (deps instanceof Promise) {
      return deps.then(resolvedDependencies => {
        return _resolve(descriptor, targetType, resolvedDependencies);
      }).then(_setCache);
    } else {
      const resInstance = _resolve(descriptor, targetType, deps as IResolvedInjection[]);
      if (resInstance instanceof Promise) {
        return resInstance.then(_setCache);
      }

      _setCache(resInstance);
      return resInstance;
    }



    function _setCache(r: any) {
      if (descriptor.resolver === ResolveType.Singleton) {
        if (!self.has(targetType, true)) {
          self.Cache.set(cacheKey, r);
        }
      } else if (descriptor.resolver === ResolveType.PerChildContainer) {
        if (!self.has(targetType, false)) {
          self.Cache.set(cacheKey, r);
        }
      }
      return r;
    }

    function _resolve(d: IInjectDescriptor, t: Class<T>, i: IResolvedInjection[]) {

      const tname = (typeof sourceType === "string") ? sourceType : sourceType.name;

      if (d.resolver === ResolveType.NewInstance) {
        return _getNewInstance(t, i);
      }

      if (!self.Registry.has(tname)) {
        self.Registry.set(tname, [t]);
      } else {
        if (!self.Registry.get(tname).find(tt => tt.name === t.name)) {
          self.Registry.set(tname, self.Registry.get(tname).concat(t));
        }
      }

      return _getCachedInstance(cacheKey, d.resolver === ResolveType.Singleton ? true : false) || _getNewInstance(t, i);
    }

    function _extractDescriptor<T>(type: Abstract<T> | Constructor<T> | Factory<T>) {

      const descriptor: IInjectDescriptor = {
        inject: [],
        resolver: ResolveType.Singleton
      };

      reduce(type);


      descriptor.inject = _.uniqWith(descriptor.inject, (a, b) => {
        return a.inject.name === b.inject.name;
      });

      return descriptor;

      function reduce(t: any) {
        if (!t) {
          return;
        }

        if (t[DI_DESCRIPTION_SYMBOL]) {
          descriptor.inject = descriptor.inject.concat(t[DI_DESCRIPTION_SYMBOL].inject);
          descriptor.resolver = t[DI_DESCRIPTION_SYMBOL].resolver;
        }

        reduce(t.prototype);
        reduce(t.__proto__);
      }
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
      if (self.has(e, parent)) {
        return self.get(e, parent);
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
