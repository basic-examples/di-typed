import {
  register,
  fromClass,
  fromFunction,
  UnresolvedKeys,
  fromValue,
  DIRegistration,
  createFromAlias,
  InferContainerType,
} from "di-typed";

type Expand<T> = T extends infer I extends object
  ? { [K in keyof I]: I[K] }
  : T;

type IsSameType<X, Y> = (<T>() => T extends X ? 0 : 1) extends <
  T
>() => T extends Y ? 0 : 1
  ? true
  : false;

function noop(..._: any[]): any {}

function assert(value: boolean): void;
function assert<T extends true>(value: T): void;
function assert(value: boolean) {
  if (!value) {
    throw new Error("Assertion failed");
  }
}

function assertThrow(fn: () => void) {
  try {
    fn();
    throw new Error("Assertion failed");
  } catch (e) {
    return;
  }
}

// Intended usage
(() => {
  interface MyRepository {
    saveSomething(): void;
  }
  interface MyService {
    returnSomething(): string;
  }
  interface WeirdService {
    wtf(): void;
  }

  interface ScopeContext {
    something: string;
  }

  interface All {
    myService: MyService;
    myRepository: MyRepository;
    someNonexistentKey: never;
    weirdDependent: WeirdService;
    context: ScopeContext;
  }

  class MyRepositoryImpl implements MyRepository {
    saveSomething = noop;
    maybeMore = noop;
  }
  class MyServiceImpl implements MyService {
    private readonly context: ScopeContext;
    constructor({
      myRepository,
      context,
    }: Pick<All, "myRepository" | "context">) {
      noop(myRepository);
      this.context = context;
    }
    returnSomething = () => this.context.something;
    maybeMore = noop;
  }
  class WeirdServiceImpl implements WeirdService {
    constructor({ someNonexistentKey }: Pick<All, "someNonexistentKey">) {
      noop(someNonexistentKey);
    }
    wtf = noop;
  }

  const builder = register({
    myRepository: fromClass(MyRepositoryImpl),
    weirdDependent: fromClass(WeirdServiceImpl),
    context: fromFunction<ScopeContext>(() => ({
      something: "hello",
    })).scoped(),
    myService: fromClass(MyServiceImpl).scoped(),
  });

  const container = builder.build();
  type Container = Expand<typeof container>;

  assert(container.myService.returnSomething() === "hello");

  const scope = container._scope();

  scope.context.something = "world";

  assert(container.myService.returnSomething() === "hello");
  assert(scope.myService.returnSomething() === "world");

  assertThrow(() => {
    // @ts-expect-error
    container.weirdDependent;
  });

  assert<
    IsSameType<
      UnresolvedKeys<typeof builder, "weirdDependent">,
      "someNonexistentKey"
    >
  >(true);

  assert<
    IsSameType<
      InferContainerType<Container>,
      {
        readonly myRepository: MyRepositoryImpl;
        readonly context: ScopeContext;
        readonly myService: MyServiceImpl;
      }
    >
  >(true);
})();

// Why not resolved
(() => {
  type A = Record<"a", string>;
  type B = Record<"b", string>;
  type C = Record<"c", string>;
  type D = Record<"d", string>;
  type E = Record<"e", string>;
  type F = Record<"f", string>;
  type G = Record<"g", string>;
  type H = Record<"h", string>;

  interface All {
    a: A;
    b: B;
    c: C;
    d: D;
    e: E;
    f: F;
    g: G;
    h: H;
  }

  const builder = register({
    a: fromValue({ a: "a" }),
    b: fromValue({ b: "b" }),
    c: fromFunction(({ a, b }: Pick<All, "a" | "b">) => ({
      c: a.a + b.b,
    })),
    e: fromFunction(({ g, h }: Pick<All, "g" | "h">) => ({
      e: g.g + h.h,
    })),
    f: fromFunction(({ d, e }: Pick<All, "d" | "e">) => ({
      f: d.d + e.e,
    })),
  });

  assert<IsSameType<UnresolvedKeys<typeof builder, "f">, "d" | "g" | "h">>(
    true
  );
})();

// Optional dependencies
(() => {
  interface MyRepository {
    hasDB(): boolean;
  }
  interface MyDB {
    doSomething(): void;
  }

  interface All {
    myRepository: MyRepository;
    myDB?: MyDB;
  }

  class MyRepositoryImpl implements MyRepository {
    private readonly myDB: MyDB | undefined;
    constructor({ myDB }: Pick<All, "myDB">) {
      this.myDB = myDB;
    }
    hasDB = () => this.myDB !== undefined;
  }

  const builder = register({
    myRepository: fromClass(MyRepositoryImpl),
    myDB: fromValue(undefined),
  });
  const container = builder.build();

  assert(container.myRepository.hasDB() === false);
})();

// Lifetime check
(() => {
  type A = Record<"a", string>;
  type B = Record<"b", string>;

  interface All {
    a: A;
    b: B;
  }

  class AImpl implements A {
    constructor({ b }: Pick<All, "b">) {
      noop(b);
    }
    a = "a";
  }

  class BImpl implements B {
    b = "b";
  }

  const builder1 = register({
    b: fromClass(BImpl).transient(),
  }).register({ a: fromClass(AImpl) });
  assert<typeof builder1 extends string ? true : false>(true);

  const builder2 = register({ a: fromClass(AImpl) }).register({
    b: fromClass(BImpl).transient(),
  });
  assert<typeof builder2 extends string ? true : false>(true);
})();

// Alias
(() => {
  interface A {
    a: string;
  }

  interface All {
    a: A;
    b: A;
  }

  const fromAlias = createFromAlias<All>();

  class AImpl implements A {
    a = "a";
  }

  const builder = register({
    a: fromClass(AImpl),
    b: fromAlias("a"),
  });

  const container = builder.build();

  assert(container.a === container.b);
  assert<
    IsSameType<
      InferContainerType<typeof container>,
      { readonly a: AImpl; readonly b: A }
    >
  >(true);
})();

// Dispose
(() => {
  class DisposeAll {
    private readonly disposables: (() => void)[] = [];

    public add(disposable: () => void) {
      this.disposables.push(disposable);
    }

    public dispose() {
      this.disposables.forEach((disposable) => disposable());
    }
  }

  class DisposeScope extends DisposeAll {
    constructor({ disposeAll }: Pick<All, "disposeAll">) {
      super();
      disposeAll.add(() => {
        this.dispose();
      });
    }
  }

  interface All {
    disposeAll: DisposeAll;
    disposeScope: DisposeScope;
    // ...
  }

  class SingletonDisposable {
    public disposed: boolean;
    constructor({ disposeAll }: Pick<All, "disposeAll">) {
      this.disposed = false;
      disposeAll.add(() => {
        this.disposed = true;
      });
    }
  }

  class ScopedDisposable {
    public disposed: boolean;
    constructor({ disposeScope }: Pick<All, "disposeScope">) {
      this.disposed = false;
      disposeScope.add(() => {
        this.disposed = true;
      });
    }
  }

  const container = register({
    disposeAll: fromClass(DisposeAll),
    disposeScope: fromClass(DisposeScope).scoped(),
    // ...
    singletonDisposable: fromClass(SingletonDisposable),
    scopedDisposable1: fromClass(ScopedDisposable).scoped(),
    scopedDisposable2: fromClass(ScopedDisposable).scoped(),
  }).build();

  const scope1 = container._scope();
  const scope2 = container._scope();

  assert(container.singletonDisposable.disposed === false);
  assert(container.scopedDisposable1.disposed === false);
  assert(container.scopedDisposable2.disposed === false);
  assert(scope1.singletonDisposable.disposed === false);
  assert(scope1.scopedDisposable1.disposed === false);
  assert(scope1.scopedDisposable2.disposed === false);
  assert(scope2.singletonDisposable.disposed === false);
  assert(scope2.scopedDisposable1.disposed === false);
  assert(scope2.scopedDisposable2.disposed === false);

  scope1.disposeScope.dispose();

  assert(container.singletonDisposable.disposed === false);
  assert(container.scopedDisposable1.disposed === false);
  assert(container.scopedDisposable2.disposed === false);
  assert(scope1.singletonDisposable.disposed === false);
  assert(scope1.scopedDisposable1.disposed === true);
  assert(scope1.scopedDisposable2.disposed === true);
  assert(scope2.singletonDisposable.disposed === false);
  assert(scope2.scopedDisposable1.disposed === false);
  assert(scope2.scopedDisposable2.disposed === false);

  container.disposeAll.dispose();

  assert(container.singletonDisposable.disposed === true);
  assert(container.scopedDisposable1.disposed === true);
  assert(container.scopedDisposable2.disposed === true);
  assert(scope1.singletonDisposable.disposed === true);
  assert(scope1.scopedDisposable1.disposed === true);
  assert(scope1.scopedDisposable2.disposed === true);
  assert(scope2.singletonDisposable.disposed === true);
})();
