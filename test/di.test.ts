import { ArgumentException } from '@spinajs/exceptions'
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { Autoinject, Container, DI, Inject, LazyInject, NewInstance, PerChildInstance, Singleton } from '../src';

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
class TestModule {
    public Initialized = false;

    // tslint:disable-next-line: no-empty
    public async initialize() {
        this.Initialized = true;
    }
}

@Singleton()
// @ts-ignore
class TestModuleSync {
    public Initialized = false;

    // tslint:disable-next-line: no-empty
    public initialize() {
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

class ThenableClassTest {

    public ThenCalled = false;

    // tslint:disable-next-line: no-empty
    public then(_: (rows: any[]) => void, __: (err: Error) => void) {
        this.ThenCalled = true;
    }
}

describe("Dependency injection", () => {
    beforeEach(() => {
        DI.clear();
    })

    it("then func should not be called on class at resolve", async () => {
        const instance = DI.resolve(ThenableClassTest) as ThenableClassTest;
        expect(instance.ThenCalled).to.be.false;

    })

    it("Inject container", async () => {
        const instance = await DI.resolve<TestInjectContainerAsParameter>(TestInjectContainerAsParameter);
        const instance2 = await DI.resolve<TestInjectContainerAsProperty>(TestInjectContainerAsProperty);
        const root = DI.RootContainer;
        expect(instance.container === root).to.be.true;
        expect(instance2.container === root).to.be.true;

    })

    it("Inject child container", async () => {
        const child = DI.child();
        const instance = await child.resolve<TestInjectContainerAsParameter>(TestInjectContainerAsParameter);
        const instance2 = await child.resolve<TestInjectContainerAsProperty>(TestInjectContainerAsProperty);
        const root = DI.RootContainer;
        expect(instance.container === root).to.be.false;
        expect(instance2.container === root).to.be.false;
        expect(instance.container === child).to.be.true;
        expect(instance2.container === child).to.be.true;
    })

    it("Should inject on base class declaration", async () => {
        const instance = await DI.resolve<ChildClass>(ChildClass);
        expect(instance.baseInject).to.be.not.null;
        expect(instance.baseInject instanceof BaseInject).to.be.true;
    });

    it("Framework module initialization strategy", async () => {
        const module = await DI.resolve<TestModule>(TestModule);

        expect(module).to.be.not.null;
        expect(module.Initialized).to.be.true;
    })

    it("Framework module initialization strategy sync", async () => {
        const module = await DI.resolve<TestModuleSync>(TestModuleSync);

        expect(module).to.be.not.null;
        expect(module.Initialized).to.be.true;
    })

    it("Register multiple classes with same base class", async () => {
        DI.register(SampleImplementation1).as(SampleBaseClass);
        DI.register(SampleImplementation2).as(SampleBaseClass);

        const val = await DI.resolve(Array.ofType(SampleBaseClass));
        expect(val).to.be.not.null;
        expect(val.length).to.eq(2);
        expect(val[0] instanceof SampleBaseClass).to.be.true;
        expect(val[1] instanceof SampleBaseClass).to.be.true;


    });

    it("Autoinject resolve", async () => {

        const autoinjected = await DI.resolve<AutoinjectClass>(AutoinjectClass);

        expect(autoinjected).to.be.not.null;
        expect(autoinjected.Test).to.be.not.null;
        expect(autoinjected.Test instanceof AutoinjectBar).to.be.true;
    })

    it("Lazy inject check", async () => {

        const lazyinject = await DI.resolve<LazyInjectResolve>(LazyInjectResolve);

        expect(LazyInjectDep.Counter).to.eq(0);

        const dep = lazyinject.Instance;
        expect(dep).to.be.instanceof(LazyInjectDep);

    })

    it("Singleton creation", async () => {

        // root 
        const single = await DI.resolve<Foo>(Foo);
        const single2 = await DI.resolve<Foo>(Foo);

        expect(Foo.Counter).to.eq(1);
        expect(single === single2).to.equal(true);

        // child
        {
            const child = DI.child();
            const single3 = await child.resolve<Foo>(Foo);
            const single4 = await child.resolve<Foo>(Foo);

            expect(Foo.Counter).to.eq(1);
            expect((single === single3 && single === single4)).to.equal(true);

            // second level child
            {
                const child2= child.child();
                const single5 = await child2.resolve<Foo>(Foo);
                const single6 = await child2.resolve<Foo>(Foo);

                expect(Foo.Counter).to.eq(1);
                expect((single === single5 && single === single6)).to.equal(true);
            }
        }
    })

    it("New instance creation", async () => {
        const single = await DI.resolve<BarFar>(BarFar);
        const single2 = await DI.resolve<BarFar>(BarFar);

        expect(BarFar.Counter).to.eq(2);
        expect(single.InstanceCounter).to.eq(1);
        expect(single2.InstanceCounter).to.eq(1);
        expect(single === single2).to.equal(false);

        {
            const child = DI.child();
            const single3 = await child.resolve<BarFar>(BarFar);
            const single4 = await child.resolve<BarFar>(BarFar);

            expect(BarFar.Counter).to.eq(4);
            expect(single3.InstanceCounter).to.eq(1);
            expect(single4.InstanceCounter).to.eq(1);
            expect(single3 === single4).to.equal(false);
            expect(single3 === single).to.equal(false);
        }
    })

    it("Per child container creation", async () => {

        // root 
        const single = await DI.resolve<Far>(Far);
        const single2 = await DI.resolve<Far>(Far);

        expect(Far.Counter).to.eq(1);
        expect(single === single2).to.equal(true);

        // child
        {
            const child = DI.child();
            const single3 = await child.resolve<Far>(Far);
            const single4 = await child.resolve<Far>(Far);

            expect(Far.Counter).to.eq(2);
            expect(single3 === single4).to.equal(true);
            expect(single3 === single).to.equal(false);
        }
    });

    it("Register type as self", async () => {
        DI.register(Zar).asSelf();

        const zar = await DI.resolve(Zar);
        expect(zar).to.be.not.null;
        expect(zar.constructor.name).to.equal(Zar.name);
    })

    it("Register type as implementation of another", async () => {
        class RegisterBase { }
        class RegisterImpl implements RegisterBase { }

        DI.register(RegisterImpl).as(RegisterBase);

        const instance = await DI.resolve(RegisterBase);
        expect(instance).to.be.not.null;
        expect(instance.constructor.name).to.equal(RegisterImpl.name);
    })

    it("Register type as singleton", async () => {
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

        const instance = await DI.resolve(RegisterBase);
        const instance2 = await DI.resolve(RegisterBase);

        expect(instance).to.be.not.null;
        expect(instance2).to.be.not.null;

        expect(RegisterImpl.Count).to.eq(1);

        expect(instance.constructor.name).to.equal(RegisterImpl.name);
    })

    it("Should clear container", async () => {
        class Test { }

        await DI.resolve(Test);
        expect(DI.get("Test")).to.be.not.null;
        DI.clear();
        expect(DI.get("Test")).to.be.null;
    })

    it("Should get if type is already resolved", async () => {
        class Test { }

        await DI.resolve(Test);

        expect(DI.get("Test")).to.be.not.null;
    })

    it("Get should return null if type is not already resolved", () => {
        expect(DI.get("Test")).to.be.null;
    })

    it("Should throw if type is unknown", async () => {
        expect(() => DI.resolve(undefined)).to.throw(ArgumentException, "argument `type` cannot be null or undefined");
    })

    it("FrameworkStrategy should not resolve object", async () => {



    });

    it("Should resolve from factory func", async () => {
        class IDatabase { }

        class DatabaseImpl implements IDatabase { }

        DI.register((container: Container, connString: string) => {
            expect(container).to.be.not.null;
            expect(container.constructor.name).to.eq("Container");
            expect(connString).to.eq("root@localhost");
            return new DatabaseImpl();
        }).as(IDatabase);

        const instance = await DI.resolve<IDatabase>(IDatabase, ["root@localhost"]);
        expect(instance).to.be.not.null;
        expect(instance.constructor.name).to.eq("DatabaseImpl");
    })

    it("Should resolve from factory func with no args", async () => {
        class IDatabase { }

        class DatabaseImpl implements IDatabase { }

        DI.register((container: Container) => {
            expect(container).to.be.not.null;
            expect(container.constructor.name).to.eq("Container");
            return new DatabaseImpl();
        }).as(IDatabase);

        const instance = await DI.resolve<IDatabase>(IDatabase);
        expect(instance).to.be.not.null;
        expect(instance.constructor.name).to.eq("DatabaseImpl");
    })

    it("Should inject options at resolve", async () => {
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

        const instance = await DI.resolve<Test>(Test, ["a", 1]);
        expect(instance.A).to.eq("a");
        expect(instance.B).to.eq(1);
        expect(instance.Bar).to.be.not.null;
        expect(instance.Bar.constructor.name).to.be.eq("Bar");
    });

    it("Should construct child container", () => {
        const child = DI.RootContainer.child();
        expect(child).to.be.not.null;
    });
});

