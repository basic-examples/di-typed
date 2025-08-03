import { DIContainerBuilder, DIRegistration } from "di-typed";

function noop(...args: any[]): any {}

// Intended usage
(() => {
  interface MyRepository {
    saveSomething(): void;
  }
  interface MyService {
    doSomething(): void;
  }
  interface WeirdService {
    wtf(): void;
  }

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

  const result = DIContainerBuilder.register({
    myService: DIRegistration.fromClass(MyServiceImpl),
    myRepository: DIRegistration.fromClass(MyRepositoryImpl),
    weirdDependent: DIRegistration.fromClass(WeirdServiceImpl),
  }).build();

  result.myService.doSomething();

  // @ts-expect-error
  result.weirdDependent;
})();
