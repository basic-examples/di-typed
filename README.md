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
* `<DIRegistration>.singleton()` – Create `DIRegistration` with singleton lifetime
* `<DIRegistration>.scoped()` – Create `DIRegistration` with scoped lifetime
* `<DIRegistration>.transient()` – Create `DIRegistration` with transient lifetime
* `register()` – Create `DIContainerBuilder` with `DIRegistration` map
* `<DIContainerBuilder>.register()` – Instance method variant of `register()` for incremental registration
* `<DIContainerBuilder>.build()` – Finalize and create a `DIContainer`
* `<DIContainer>._scope()` – Instantiate a new scoped container
* `CircularDependencyError` – Error thrown when a cycle is detected in dependency graph
* `createFromAlias<Map>()` - Create a `fromAlias` function with your own `All` type
* `UnresolvedKeys<Builder, Key>` – Type-level utility to check which dependencies are missing for a given key
  * If there's a circular dependency, `UnresolvedKeys<Builder, Key>` may resolves to `never`.
* `InferContainerType<Container>` – Infer the type of the container from the `DIContainer`

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
type Container = InferContainerType<typeof container>;
/*
type Container = {
  readonly myRepository: MyRepositoryImpl;
  readonly myService: MyServiceImpl;
}
*/

type Missing = UnresolvedKeys<typeof builder, "weirdDependent">;
// "someNonexistentKey"
```

## What is `All` type?

`All` type is a type that contains all the potential dependencies that are registered in the container.

You don't absolutely need it, but it's very inconvenient without it.

It enables better type safety and developer ergonomics.

## Lifetime Semantics

Each registration must specify its lifetime explicitly via `.singleton()`, `.scoped()`, or `.transient()`.

| Lifetime    | Description                                                           | Instance Lifetime |
|-------------|-----------------------------------------------------------------------|-------------------|
| `singleton` | One shared instance across the entire container, including all scopes | Per container     |
| `scoped`    | A new instance is created for each scope, shared within that scope    | Per scope         |
| `transient` | A new instance is created **every time** it is accessed or injected   | Per access        |

### When to use

* **singleton**: Use for stateless services or long-lived shared instances (e.g., repositories, loggers)
* **scoped**: Use for contextual or per-request state (e.g., user context, trace id, DI-managed `DisposeScope`)
* **transient**: Use for disposable or short-lived instances, or when isolation between usages is needed

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

## Need alias?

You can define your own `fromAlias` function using `createFromAlias` function with your own `All` type.

```ts
export const fromAlias = createFromAlias<All>();

// usage: builder.register({ db: fromAlias("real_db").scoped() });
```

## Need dispose?

Maybe you don't need it, so the library doesn't include it.

If you really need dispose, you can define your own.

```ts
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

// from singleton
class SingletonDisposable {
  public disposed: boolean;
  constructor({ disposeAll }: Pick<All, "disposeAll">) {
    this.disposed = false;
    disposeAll.add(() => {
      this.disposed = true;
    });
  }
}

// from scoped
class ScopedDisposable {
  public disposed: boolean;
  constructor({ disposeScope }: Pick<All, "disposeScope">) {
    this.disposed = false;
    disposeScope.add(() => {
      this.disposed = true;
    });
  }
}
```

## License

MIT
