# `di-typed`: Type-Safe, Minimal Dependency Injection for Testing

`di-typed` is a lightweight, type-safe Dependency Injection (DI) library focused on testability and minimal configuration.
It enforces precise dependency declarations, ensuring that components only receive what they explicitly depend on—nothing more, nothing less.

* Comprehensive TypeScript support
* Automatically excludes registrations with unresolved dependencies
* Promotes explicit and minimal dependency declarations
* Designed for testing and modular design
* Supports standard lifetimes: singleton, scoped, transient

## API Overview

* `fromClass()` – Create a `DIRegistration` from a class whose first constructor parameter receives dependencies
* `fromFunction()` – Create `DIRegistration` by a factory function that receives dependencies as its first parameter
* `fromValue()` – Create `DIRegistration` by a constant value
* `DIRegistration::singleton()` – Create `DIRegistration` with singleton lifetime
* `DIRegistration::scoped()` – Create `DIRegistration` with scoped lifetime
* `DIRegistration::transient()` – Create `DIRegistration` with transient lifetime
* `register()` – Create `DIContainerBuilder` with `DIRegistration` map
* `DIContainerBuilder::register()` – Instance method variant of `register()` for incremental registration
* `DIContainerBuilder::build()` – Finalize and create a `DIContainer`
* `DIContainer::_scope()` – Instantiate a new scoped container
* `UnresolvedKeys<Builder, Key>` – Type-level utility to check which dependencies are missing for a given key
  * If there's a circular dependency, `UnresolvedKeys<Builder, Key>` resolves to `never`.
* `CircularDependencyError` – Error thrown when a cycle is detected in dependency graph

## Basic Usage Example

```ts
interface All {
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
  constructor({ myRepository }: Pick<All, "myRepository">) {
    noop(myRepository);
  }
  doSomething = noop;
  maybeMore = noop;
}

class WeirdServiceImpl implements WeirdService {
  constructor({
    someNonexistentKey,
  }: Pick<All, "someNonexistentKey">) {
    noop(someNonexistentKey);
  }
  wtf = noop;
}

// Create and build the container
const builder = register({
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
  private readonly context: ScopeContext;
  constructor(deps: Record<"context", ScopeContext>) {
    this.context = deps.context;
  }
  printSomething(): void {
    console.log(this.context.something);
  }
}

// Register scoped dependencies
const container = builder
  .register({
    context: fromFunction<ScopeContext>(() => ({ something: "hello" })).scoped(),
    contextPrinter: fromClass(ContextPrinter).scoped(),
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
