import { registerSingleton, fromClass, fromFunction } from "di-typed";

function noop(...args: any[]): any {}

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

  const result = registerSingleton({
    myRepository: fromClass(MyRepositoryImpl),
    weirdDependent: fromClass(WeirdServiceImpl),
  })
    .registerScoped({
      context: fromFunction<ScopeContext>(() => ({ something: "hello" })),
      myService: fromClass(MyServiceImpl),
    })
    .build();

  assert(result.myService.returnSomething() === "hello");

  const scope = result._scope();

  scope.context.something = "world";

  assert(result.myService.returnSomething() === "hello");
  assert(scope.myService.returnSomething() === "world");

  assertThrow(() => {
    // @ts-expect-error
    result.weirdDependent;
  });
})();
