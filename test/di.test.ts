import { ArgumentException } from '@spinajs/exceptions'
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { AsyncResolveStrategy, Autoinject, Container, DI, Inject, LazyInject, NewInstance, PerChildInstance, ResolveStrategy, Singleton, Injectable } from '../src';

const expect = chai.expect;
chai.use(chaiAsPromised);

@Singleton()
// @ts-ignore
class Foo {
    public static Counter: number;

    public static initialize() {
        Foo.Counter = 0;
    }

    constructor() {
        Foo.Counter++;
    }
}

Foo.initialize();

@NewInstance()
// @ts-ignore
class BarFar {
    public static Counter: number;
    public static initialize() {
        BarFar.Counter = 0;
    }

    public InstanceCounter = 0;
    constructor() {
        BarFar.Counter++;
        this.InstanceCounter++;
    }
}

BarFar.initialize();

@PerChildInstance()
// @ts-ignore
class Far {
    public static Counter: number;
    public static initialize() {
        Far.Counter = 0;
    }

    constructor() {
        Far.Counter++;
    }
}
Far.initialize();


class Zar {

}



class AutoinjectBar {

}

class AutoinjectClass {

    @Autoinject()
    // @ts-ignore
    public Test: AutoinjectBar = null;
}

class LazyInjectDep {
    public static Counter: number;

    constructor() {
        LazyInjectDep.Counter++;
    }
}

LazyInjectDep.Counter = 0;


class LazyInjectResolve {
    @LazyInject(LazyInjectDep)
    // @ts-ignore
    public Instance: LazyInjectDep;
}

abstract class SampleBaseClass {
    public Name: string;
}

class SampleImplementation1 extends SampleBaseClass {

    constructor() {
        super();

        this.Name = "Sample1";
    }
}

class SampleImplementation2 extends SampleBaseClass {
    constructor() {
        super();

        this.Name = "Sample2";
    }
}

// class SampleMultipleAutoinject {

//     @Autoinject(SampleBaseClass)
//     // @ts-ignore
//     public Instances: SampleBaseClass[];


// }

@Singleton()
// @ts-ignore
class TestModule extends ResolveStrategy {
    public Initialized = false;

    // tslint:disable-next-line: no-empty
    public resolve() {
        this.Initialized = true;
    }
}



@Inject(Container)
// @ts-ignore
class TestInjectContainerAsParameter {

    constructor(public container: Container) {

    }
}

class TestInjectContainerAsProperty {

    @Autoinject()
    // @ts-ignore
    public container: Container;
}


class BaseInject {

}

@Inject(BaseInject)
// @ts-ignore
class BaseClass {
    constructor(public baseInject: BaseInject) { }
}

class ChildClass extends BaseClass {

}


describe("Dependency injection", () => {
    beforeEach(() => {
        DI.clear();
    })

    it("Inject container", () => {
        const instance = DI.resolve<TestInjectContainerAsParameter>(TestInjectContainerAsParameter);
        const instance2 = DI.resolve<TestInjectContainerAsProperty>(TestInjectContainerAsProperty);
        const root = DI.RootContainer;
        expect(instance.container === root).to.be.true;
        expect(instance2.container === root).to.be.true;
    })

    it("Injectable should register class", () => {

        @Injectable()
        class InjectableTest {

        }

        const registry = DI.RootContainer.Registry;

        expect(registry).to.be.an("Map").that.have.length(1);
        expect(registry.get(InjectableTest)).to.be.an("array").that.have.length(1);
        expect(registry.get(InjectableTest)[0]).to.be.not.null;
        expect(DI.resolve(InjectableTest)).to.be.not.null;
    })

    it("Injectable should register class as another", () => {

        class InjectableBase {

        }

        @Injectable(InjectableBase)
        class InjectableTest {

        }



        const registry = DI.RootContainer.Registry;

        expect(registry).to.be.an("Map").that.have.length(1);
        expect(registry.get(InjectableBase)).to.be.an("array").that.have.length(1);
        expect(registry.get(InjectableBase)[0]).to.be.not.null;
        expect(registry.get(InjectableBase)[0].name).to.eq("InjectableTest");
        expect(DI.resolve(InjectableBase)).to.be.instanceOf(InjectableTest)
 
    })

    it("Injectable should register multiple class as another", () => {

        class InjectableBase {

        }

        @Injectable(InjectableBase)
        class InjectableTest {

        }

        @Injectable(InjectableBase)
        class InjectableTest2 {

        }



        const registry = DI.RootContainer.Registry;

        expect(registry).to.be.an("Map").that.have.length(1);
        expect(registry.get(InjectableBase)).to.be.an("array").that.have.length(2);
        expect(registry.get(InjectableBase)[0]).to.be.not.null;
        expect(registry.get(InjectableBase)[0].name).to.eq("InjectableTest");

        const services = DI.resolve(Array.ofType(InjectableBase));
        expect(services).to.be.an("array").that.have.length(2);
        expect(services[0]).to.be.instanceOf(InjectableTest);
        expect(services[1]).to.be.instanceOf(InjectableTest2);
    })


    it("Inject child container", () => {
        const child = DI.child();
        const instance = child.resolve<TestInjectContainerAsParameter>(TestInjectContainerAsParameter);
        const instance2 = child.resolve<TestInjectContainerAsProperty>(TestInjectContainerAsProperty);
        const root = DI.RootContainer;
        expect(instance.container === root).to.be.false;
        expect(instance2.container === root).to.be.false;
        expect(instance.container === child).to.be.true;
        expect(instance2.container === child).to.be.true;
    })

    it("Should inject on base class declaration", () => {
        const instance = DI.resolve<ChildClass>(ChildClass);
        expect(instance.baseInject).to.be.not.null;
        expect(instance.baseInject instanceof BaseInject).to.be.true;
    });

    it("Framework module initialization strategy", () => {
        const module = DI.resolve<TestModule>(TestModule);

        expect(module).to.be.not.null;
        expect(module.Initialized).to.be.true;
    })

    it("Register multiple classes with same base class", () => {
        DI.register(SampleImplementation1).as(SampleBaseClass);
        DI.register(SampleImplementation2).as(SampleBaseClass);

        const val = DI.resolve(Array.ofType(SampleBaseClass));
        expect(val).to.be.not.null;
        expect(val.length).to.eq(2);
        expect(val[0] instanceof SampleImplementation1).to.be.true;
        expect(val[1] instanceof SampleImplementation2).to.be.true;


    });

    it("Autoinject resolve", () => {

        const autoinjected = DI.resolve<AutoinjectClass>(AutoinjectClass);

        expect(autoinjected).to.be.not.null;
        expect(autoinjected.Test).to.be.not.null;
        expect(autoinjected.Test instanceof AutoinjectBar).to.be.true;
    })

    it("Lazy inject check", () => {

        const lazyinject = DI.resolve<LazyInjectResolve>(LazyInjectResolve);

        expect(LazyInjectDep.Counter).to.eq(0);

        const dep = lazyinject.Instance;
        expect(dep).to.be.instanceof(LazyInjectDep);

    })

    it("Singleton creation", () => {

        // root 
        const single = DI.resolve<Foo>(Foo);
        const single2 = DI.resolve<Foo>(Foo);

        expect(Foo.Counter).to.eq(1);
        expect(single === single2).to.equal(true);

        // child
        {
            const child = DI.child();
            const single3 = child.resolve<Foo>(Foo);
            const single4 = child.resolve<Foo>(Foo);

            expect(Foo.Counter).to.eq(1);
            expect((single === single3 && single === single4)).to.equal(true);

            // second level child
            {
                const child2 = child.child();
                const single5 = child2.resolve<Foo>(Foo);
                const single6 = child2.resolve<Foo>(Foo);

                expect(Foo.Counter).to.eq(1);
                expect((single === single5 && single === single6)).to.equal(true);
            }
        }
    })

    it("New instance creation", () => {
        const single = DI.resolve<BarFar>(BarFar);
        const single2 = DI.resolve<BarFar>(BarFar);

        expect(BarFar.Counter).to.eq(2);
        expect(single.InstanceCounter).to.eq(1);
        expect(single2.InstanceCounter).to.eq(1);
        expect(single === single2).to.equal(false);

        {
            const child = DI.child();
            const single3 = child.resolve<BarFar>(BarFar);
            const single4 = child.resolve<BarFar>(BarFar);

            expect(BarFar.Counter).to.eq(4);
            expect(single3.InstanceCounter).to.eq(1);
            expect(single4.InstanceCounter).to.eq(1);
            expect(single3 === single4).to.equal(false);
            expect(single3 === single).to.equal(false);
        }
    })

    it("Per child container creation", () => {

        // root 
        const single = DI.resolve<Far>(Far);
        const single2 = DI.resolve<Far>(Far);

        expect(Far.Counter).to.eq(1);
        expect(single === single2).to.equal(true);

        // child
        {
            const child = DI.child();
            const single3 = child.resolve<Far>(Far);
            const single4 = child.resolve<Far>(Far);

            expect(Far.Counter).to.eq(2);
            expect(single3 === single4).to.equal(true);
            expect(single3 === single).to.equal(false);
        }
    });

    it("Register type as self", () => {
        DI.register(Zar).asSelf();

        const zar = DI.resolve(Zar);
        expect(zar).to.be.not.null;
        expect(zar.constructor.name).to.equal(Zar.name);
    })

    it("Register type as implementation of another", () => {
        class RegisterBase { }
        class RegisterImpl implements RegisterBase { }

        DI.register(RegisterImpl).as(RegisterBase);

        const instance = DI.resolve(RegisterBase);
        expect(instance).to.be.not.null;
        expect(instance.constructor.name).to.equal(RegisterImpl.name);
    })

    it("Register type as singleton", () => {
        class RegisterBase {
            public static Count: number;
        }
        RegisterBase.Count = 0;
        class RegisterImpl implements RegisterBase {
            public static Count: number;
            constructor() {
                RegisterImpl.Count++;
            }
        }
        RegisterImpl.Count = 0;


        DI.register(RegisterImpl).as(RegisterBase);

        const instance = DI.resolve(RegisterBase);
        const instance2 = DI.resolve(RegisterBase);

        expect(instance).to.be.not.null;
        expect(instance2).to.be.not.null;

        expect(RegisterImpl.Count).to.eq(1);

        expect(instance.constructor.name).to.equal(RegisterImpl.name);
    })

    it("Should resolve async", async () => {

        DI.clear();

        class Test extends AsyncResolveStrategy {

            public Initialized = false;

            public async resolveAsync() {
                return new Promise<void>((res) => {
                    setTimeout(() => {
                        this.Initialized = true;
                        res();
                    }, 200);
                })
            }
        }

        const instance = await DI.resolve(Test);

        expect(instance instanceof Test).to.be.true;
        expect(DI.get("Test")).to.be.not.null;
        expect(instance.Initialized).to.be.true;
    })

    it("Should clear container", () => {
        class Test { }

        DI.resolve(Test);
        expect(DI.get("Test")).to.be.not.null;
        DI.clear();
        expect(DI.get("Test")).to.be.null;
    })

    it("Should get if type is already resolved", () => {
        class Test { }

        DI.resolve(Test);

        expect(DI.get("Test")).to.be.not.null;
    })

    it("Get should return null if type is not already resolved", () => {
        expect(DI.get("Test")).to.be.null;
    })

    it("Should throw if type is unknown", () => {
        return expect(() => DI.resolve(undefined)).to.throw(ArgumentException, "argument `type` cannot be null or undefined");
    })

    it("Should resolve from factory func", () => {
        class IDatabase { }

        class DatabaseImpl implements IDatabase { }

        DI.register((container: Container, connString: string) => {
            expect(container).to.be.not.null;
            expect(container.constructor.name).to.eq("Container");
            expect(connString).to.eq("root@localhost");
            return new DatabaseImpl();
        }).as(IDatabase);

        const instance = DI.resolve<IDatabase>(IDatabase, ["root@localhost"]);
        expect(instance).to.be.not.null;
        expect(instance.constructor.name).to.eq("DatabaseImpl");
    })

    it("Should resolve from factory func with no args", () => {
        class IDatabase { }

        class DatabaseImpl implements IDatabase { }

        DI.register((container: Container) => {
            expect(container).to.be.not.null;
            expect(container.constructor.name).to.eq("Container");
            return new DatabaseImpl();
        }).as(IDatabase);

        const instance = DI.resolve<IDatabase>(IDatabase);
        expect(instance).to.be.not.null;
        expect(instance.constructor.name).to.eq("DatabaseImpl");
    })

    it("Should inject options at resolve", () => {
        class Bar { }

        @Inject(Bar)
        // @ts-ignore
        class Test {
            public A: string;
            public B: number;
            public Bar: Bar;

            constructor(bar: Bar, a: string, b: number) {
                this.A = a;
                this.B = b;
                this.Bar = bar;
            }
        }

        const instance = DI.resolve<Test>(Test, ["a", 1]);
        expect(instance.A).to.eq("a");
        expect(instance.B).to.eq(1);
        expect(instance.Bar).to.be.not.null;
        expect(instance.Bar.constructor.name).to.be.eq("Bar");
    });

    it("Should construct child container", () => {
        const child = DI.RootContainer.child();
        expect(child).to.be.not.null;
    });

    it("Should check if registered", ()=>{
        @Injectable()
        //@ts-ignore
        class FooBar{}

        class ZarFar{}

        expect(DI.check(FooBar)).to.eq(true);
        expect(DI.check(ZarFar)).to.eq(false);
    })

    it("Should check if registered with parent",()=>{

        @Injectable()
        //@ts-ignore
        class FooBar{}

        class ZarFar{}

        {
            const child = DI.child();

            expect(child.check(FooBar, true)).to.eq(true);
            expect(child.check(FooBar, false)).to.eq(false);

            expect(child.check(ZarFar,true)).to.eq(false);
            expect(child.check(ZarFar, false)).to.eq(false);

        }


    })

    it("Should throw if resolving with check",()=>{

        class FooBar{}
        expect(() =>{ 
            DI.resolve(FooBar, true);
        }).to.throw;

    });

    it("Should get All with Array.typeOf", () =>{ 


        class InjectableBase {

        }

        @Injectable(InjectableBase)
        //@ts-ignore
        class InjectableTest {

        }

        @Injectable(InjectableBase)
        //@ts-ignore
        class InjectableTest2 {

        }

        DI.resolve(Array.ofType(InjectableBase));

        const getted = DI.get(Array.ofType(InjectableBase));

        expect(getted.length).to.be.an("array").that.have.length(2);
        expect(getted[0]).to.be.instanceOf(InjectableTest);
        expect(getted[1]).to.be.instanceOf(InjectableTest2);


    })
});

