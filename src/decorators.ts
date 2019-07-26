import { ResolveType } from "./enums";
import { IInjectDescriptor } from "./interfaces";
import { DI } from "./root";


export const DI_DESCRIPTION_SYMBOL = Symbol.for('DI_INJECTION_DESCRIPTOR');

function injectable(callback?: (descriptor: IInjectDescriptor<any>, target: ArrayBuffer, propertyKey: string | symbol, indexOrDescriptor: number | PropertyDescriptor) => void): any {
    return (target: any, propertyKey: string | symbol, indexOrDescriptor: number | PropertyDescriptor) => {
        let descriptor: IInjectDescriptor<any> = target[DI_DESCRIPTION_SYMBOL];
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
export function Inject(...args: Class[]) {
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
export function InjectAll(...args: Class[]) {
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
export function Autoinject(injectType?: Class) {
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
export function LazyInject(service: Constructor | string) {
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