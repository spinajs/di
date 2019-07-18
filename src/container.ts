import { ArgumentException } from "@spinajs/exceptions";
import * as _ from 'lodash';
import 'reflect-metadata';
import { ResolveType } from "./enums";
import { isConstructor } from './helpers';
import { IBind, IContainer, IResolvedInjection, IResolveStrategy } from './interfaces';
import { Factory } from './types';

/**
 * Dependency injection container implementation
 */
export class Container implements IContainer {
  /**
   * Handles information about what is registered as what
   * eg. that class IConfiguration should be resolved as DatabaseConfiguration etc.
   * @access private
   */
  private registry: Map<Class<any>, any[]>;

  /**
   * Singletons cache, objects that should be created only once are stored here.
   * @access private
   */
  private cache: Map<string, any[] | any>;

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

  public get Registry(): Map<Class<any>, any[]> {
    return this.registry;
  }

  constructor(parent?: Container) {
    this.registry = new Map<Class<any>, any[]>();
    this.cache = new Map<string, any[]>();

    if (parent) {
      this.strategies = parent.ResolveStrategies.slice(0);
    }

    this.parent = parent;

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
  public register<T>(implementation: Class<T>): IBind {
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
  public child(): Container {
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

  public async resolve<T>(type: Class<T> | Factory<T>, options?: any[]): Promise<T> {
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

        await Promise.all(self.strategies.map(s => s.resolve(newInstance, self)));
      }

      return newInstance;
    }
  }

  // allows container instance to be resolved
  private registerSelf() {
    this.cache.set("Container", this);
  }
}
