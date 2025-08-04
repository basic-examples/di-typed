import {
  registerSingleton,
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

function noop(...args: any[]): any {}

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

  interface AllRegistrations {
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
    }: Pick<AllRegistrations, "myRepository" | "context">) {
      noop(myRepository);
      this.context = context;
    }
    returnSomething = () => this.context.something;
    maybeMore = noop;
  }
  class WeirdServiceImpl implements WeirdService {
    constructor({
      someNonexistentKey,
    }: Pick<AllRegistrations, "someNonexistentKey">) {
      noop(someNonexistentKey);
    }
    wtf = noop;
  }

  const builder = registerSingleton({
    myRepository: fromClass(MyRepositoryImpl),
    weirdDependent: fromClass(WeirdServiceImpl),
  }).registerScoped({
    context: fromFunction<ScopeContext>(() => ({ something: "hello" })),
    myService: fromClass(MyServiceImpl),
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
  interface A {
    a: string;
  }
  interface B {
    b: string;
  }
  interface C {
    c: string;
  }

  interface D {
    d: string;
  }

  interface E {
    e: string;
  }

  interface F {
    f: string;
  }

  interface G {
    g: string;
  }

  interface H {
    h: string;
  }

  interface AllRegistrations {
    a: A;
    b: B;
    c: C;
    d: D;
    e: E;
    f: F;
    g: G;
    h: H;
  }

  const builder = registerSingleton({
    a: fromValue({ a: "a" }),
    b: fromValue({ b: "b" }),
    c: fromFunction(({ a, b }: Pick<AllRegistrations, "a" | "b">) => ({
      c: a.a + b.b,
    })),
    e: fromFunction(({ g, h }: Pick<AllRegistrations, "g" | "h">) => ({
      e: g.g + h.h,
    })),
    f: fromFunction(({ d, e }: Pick<AllRegistrations, "d" | "e">) => ({
      f: d.d + e.e,
    })),
  });

  assert<IsSameType<UnresolvedKeys<typeof builder, "f">, "d" | "g" | "h">>(
    true
  );
})();
