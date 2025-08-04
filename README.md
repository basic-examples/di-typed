# `di-typed` – DI library enables precise, minimal dependencies for testing

`di-typed` is a minimalistic, type-safe Dependency Injection (DI) library designed especially for testing.  
It ensures that each component only declares exactly the dependencies it needs — no more, no less.

- Strong TypeScript support
- Auto-prune registrations with unmet dependencies
- Explicit and minimal dependency declarations
- Designed especially for testability
- Usual lifetime support: singleton, scoped, transient

## Basic Usage

```ts
// define all registrations
interface AllRegistrations {
  myService: MyService;
  myRepository: MyRepository;
  someNonexistentKey: never;
  weirdDependent: WeirdService;
}

// this doesn't requires any dependencies
class MyRepositoryImpl implements MyRepository {
  saveSomething = noop;
  maybeMore = noop;
}

// dependencies are defined in the constructor type
class MyServiceImpl implements MyService {
  constructor({ myRepository }: Pick<AllRegistrations, "myRepository">) {
    noop(myRepository);
  }
  doSomething = noop;
  maybeMore = noop;
}

// this requires a dependency that is not registered
class WeirdServiceImpl implements WeirdService {
  constructor({
    someNonexistentKey,
  }: Pick<AllRegistrations, "someNonexistentKey">) {
    noop(someNonexistentKey);
  }
  wtf = noop;
}

// build the container
const result = registerSingleton({
  myService: fromClass(MyServiceImpl),
  myRepository: fromClass(MyRepositoryImpl),
  weirdDependent: fromClass(WeirdServiceImpl),
}).build(); // you can also use registerSingleton() multiple times

type MyResult = typeof result;
/*
type MyResult = {
    readonly myRepository: MyRepositoryImpl;
    readonly myService: MyServiceImpl;
    // no weirdDependent because it requires a dependency that is not registered
}
*/
```

## Advanced Usage With Scope

```ts
declare const builder: DIContainerBuilder<Something /* ... */>;
declare class ContextPrinter {
  constructor(dependencies: Record<"context", ScopeContext>);
  public printSomething(): void;
}

// scoped instances will be instantiate per scope
const container = builder
  .registerScoped({
    context: fromFunction<ScopeContext>(() => ({ something: "hello" })),
    contextPrinter: fromClass(ContextPrinter),
  })
  .build();

container.contextPrinter.printSomething(); // hello

// you can create scope using _scope() method
const scopedContainer = container._scope();
scopedContainer.context.something = "world";

container.contextPrinter.printSomething(); // hello
scopedContainer.contextPrinter.printSomething(); // world
```

## License

MIT
