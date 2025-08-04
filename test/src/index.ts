import {
  register,
  fromClass,
  fromFunction,
  UnresolvedKeys,
  fromValue,
} from "di-typed";

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
