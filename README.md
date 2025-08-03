# `di-typed` – DI library enables precise, minimal dependencies for testing

`di-typed` is a minimalistic, type-safe Dependency Injection (DI) library designed especially for testing.  
It ensures that each component only declares exactly the dependencies it needs — no more, no less.

- Strong TypeScript support
- Auto-prune registrations with unmet dependencies
- Explicit and minimal dependency declarations
- Designed especially for testability

## Usage

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
const result = DIContainerBuilder.register({
  myService: DIRegistration.fromClass(MyServiceImpl),
  myRepository: DIRegistration.fromClass(MyRepositoryImpl),
  weirdDependent: DIRegistration.fromClass(WeirdServiceImpl),
}).build(); // you can also use register() multiple times

type MyResult = typeof result;
/*
type MyResult = {
    readonly myRepository: MyRepositoryImpl;
    readonly myService: MyServiceImpl;
    // no weirdDependent because it requires a dependency that is not registered
}
*/
```

## License

MIT
