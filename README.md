# `di-typed`: Type-Safe, Minimal Dependency Injection for Testing

`di-typed` is a lightweight, type-safe Dependency Injection (DI) library focused on testability and minimal configuration.
It enforces precise dependency declarations, ensuring that components only receive what they explicitly depend on—nothing more, nothing less.

* Comprehensive TypeScript support
* Automatically excludes registrations with unresolved dependencies
* Promotes explicit and minimal dependency declarations
* Designed for testing and modular design
* Supports standard lifetimes: singleton, scoped, transient

## API Overview

* `fromClass()` – Register a class that receives dependencies via its first constructor parameter
* `fromFunction()` – Register a factory function that receives dependencies as its first parameter
* `fromValue()` – Register a constant value
* `registerSingleton()` – Create a container builder with singleton-lifetime registrations
* `registerScoped()` – Same as above, but for scoped-lifetime registrations
* `registerTransient()` – Same as above, but for transient-lifetime registrations
* `DIContainerBuilder::register*()` – Instance-based variants of the above
* `DIContainerBuilder::build()` – Finalize and create a `DIContainer`
* `DIContainer::_scope()` – Instantiate a new scoped container
* `UnresolvedKeys<Builder, Key>` – Static type utility to inspect missing dependencies
* `CircularDependencyError` – Error thrown when a cycle is detected in dependency graph

## Basic Usage Example

```ts
interface AllRegistrations {
  myService: MyService;
  myRepository: MyRepository;
  someNonexistentKey: never;
  weirdDependent: WeirdService;
}

class MyRepositoryImpl implements MyRepository {
  saveSomething = noop;
  maybeMore = noop;
}

class MyServiceImpl implements MyService {
  constructor({ myRepository }: Pick<AllRegistrations, "myRepository">) {
    noop(myRepository);
  }
  doSomething = noop;
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

// Create and build the container
const builder = registerSingleton({
  myService: fromClass(MyServiceImpl),
  myRepository: fromClass(MyRepositoryImpl),
  weirdDependent: fromClass(WeirdServiceImpl),
});

const container = builder.build();
```

```ts
type Container = typeof container;
/*
type Container = {
  readonly myRepository: MyRepositoryImpl;
  readonly myService: MyServiceImpl;
  // and more ...
  // 'weirdDependent' is excluded due to missing dependency: 'someNonexistentKey'
}
*/

type Missing = UnresolvedKeys<typeof builder, "weirdDependent">;
// "someNonexistentKey"
```

## Scoped Dependency Example

```ts
declare const builder: DIContainerBuilder<SomeRegistrationSet>;

class ContextPrinter {
  constructor(deps: Record<"context", ScopeContext>) {}
  printSomething(): void {
    console.log(this.context.something);
  }
}

// Register scoped dependencies
const container = builder
  .registerScoped({
    context: fromFunction<ScopeContext>(() => ({ something: "hello" })),
    contextPrinter: fromClass(ContextPrinter),
  })
  .build();

// Use shared scope
container.contextPrinter.printSomething(); // "hello"

// Create a new scope
const scoped = container._scope();
scoped.context.something = "world";

container.contextPrinter.printSomething(); // "hello"
scoped.contextPrinter.printSomething();    // "world"
```

## License

MIT
