export abstract class DIRegistration<
  Self,
  const Dependencies extends Partial<Record<string, unknown>>
> {
  public abstract instantiate(dependencies: Dependencies): Self;

  public static fromClass<Self>(cls: new () => Self): DIRegistration<Self, {}>;
  public static fromClass<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(cls: new (deps: Dependencies) => Self): DIRegistration<Self, Dependencies>;
  public static fromClass<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(cls: new (deps: Dependencies) => Self): DIRegistration<Self, Dependencies> {
    return new (class extends DIRegistration<Self, Dependencies> {
      instantiate(dependencies: Dependencies) {
        return new cls(dependencies);
      }
    })();
  }

  public static fromFunction<Self>(func: () => Self): DIRegistration<Self, {}>;
  public static fromFunction<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(func: (deps: Dependencies) => Self): DIRegistration<Self, Dependencies>;
  public static fromFunction<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(func: (deps: Dependencies) => Self): DIRegistration<Self, Dependencies> {
    return new (class extends DIRegistration<Self, Dependencies> {
      instantiate(dependencies: Dependencies) {
        return func(dependencies);
      }
    })();
  }

  public static fromValue<Self>(value: Self): DIRegistration<Self, {}> {
    return new (class extends DIRegistration<Self, {}> {
      instantiate() {
        return value;
      }
    })();
  }
}

export type DIRegistrationToType<
  T extends DIRegistration<unknown, Partial<Record<string, unknown>>>
> = T extends DIRegistration<infer I, Partial<Record<string, unknown>>>
  ? I
  : never;

export type DIRegistrationToDependencies<
  T extends DIRegistration<unknown, Partial<Record<string, unknown>>>
> = T extends DIRegistration<unknown, infer I> ? I : never;

export type RegistrationMapToInstanceMap<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = {
  [K in keyof Map]-?: RegistrationToInstance<Exclude<Map[K], undefined>>;
};

export type RegistrationToInstance<
  T extends DIRegistration<unknown, Partial<Record<string, unknown>>>
> = T extends DIRegistration<infer I, Partial<Record<string, unknown>>>
  ? I
  : never;

export class CircularDependencyError extends Error {
  constructor(message: string, public readonly resolving: string) {
    super(message);
  }
}

type UnionToIntersection<T> = (
  T extends any ? (arg: T) => unknown : never
) extends (arg: infer I) => unknown
  ? I
  : never;

type UnionAny<T> = ReturnType<
  Extract<UnionToIntersection<T extends any ? () => T : never>, () => unknown>
>;

export type RegisterSingletonResult<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = Extract<
  keyof Singleton | keyof Scoped | keyof Transient,
  keyof T
> extends never
  ? RegisterSingletonResultInternal<Singleton, Scoped, Transient, T>
  : `[Error] The key ${Extract<
      Extract<keyof Singleton | keyof Scoped | keyof Transient, keyof T>,
      string
    >} is already registered`;

type RegisterSingletonResultInternal<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = keyof T extends never
  ? DIContainerBuilder<Singleton & T, Scoped, Transient>
  : string extends keyof T
  ? "[Error] The key must be a literal instead of any string"
  : UnionAny<keyof T> extends infer I extends keyof T
  ? I extends `_${string}`
    ? `[Error] Key ${I} cannot start with _`
    : T[I] extends DIRegistration<unknown, Partial<Record<string, unknown>>>
    ? I extends string
      ? RegisterSingletonError<
          Singleton,
          Scoped,
          Transient,
          I,
          DIRegistrationToType<T[I]>,
          DIRegistrationToDependencies<T[I]>
        > extends infer Error extends string
        ? [Error] extends [never]
          ? RegisterSingletonResultInternal<
              Singleton & Pick<T, I>,
              Scoped,
              Transient,
              Omit<T, I>
            >
          : Error
        : never
      : `[Error] The key ${Extract<I, string | number>} is not a string`
    : `[Error] The key ${Extract<I, string | number>} can be undefined`
  : never;

// check for existing items' dependencies and newly added item's type
type RegisterSingletonError<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Type,
  Dependencies extends Partial<Record<string, unknown>>
> = {
  [K in keyof (Singleton & Scoped & Transient)]: {
    [L in keyof DIRegistrationToDependencies<
      Exclude<(Singleton & Scoped & Transient)[K], undefined>
    >]: L extends Key
      ? DIRegistrationToDependencies<
          Exclude<(Singleton & Scoped & Transient)[K], undefined>
        >[L]
      : never;
  }[keyof DIRegistrationToDependencies<
    Exclude<(Singleton & Scoped & Transient)[K], undefined>
  >];
}[keyof (Singleton & Scoped & Transient)] extends infer I
  ? [I] extends [never]
    ? RegisterSingletonErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies
      >
    : Type extends I
    ? RegisterSingletonErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies
      >
    : `[Error] The key ${Key} has a different type than dependencies` & {
        type: Type;
        dependencies: I;
      }
  : never;

// check for newly added item's dependencies and existing items' type and lifetime
type RegisterSingletonErrorInternal<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Dependencies extends Partial<Record<string, unknown>>
> = Key extends keyof Dependencies
  ? `[Error] Key ${Key} requires self`
  :
      | {
          [K in Extract<
            keyof Dependencies,
            keyof Singleton
          >]: DIRegistrationToType<
            Exclude<Singleton[K], undefined>
          > extends Dependencies[K]
            ? never
            : `[Error] Key ${Key} has incompatible dependency: ${Extract<
                K,
                string | number
              >}`;
        }[Extract<keyof Dependencies, keyof Singleton>]
      | (Extract<keyof Dependencies, keyof Scoped> extends never
          ? never
          : `[Error] Key ${Key} is singleton but dependency ${Extract<
              Extract<keyof Dependencies, keyof Scoped>,
              string | number
            >} is scoped`)
      | (Extract<keyof Dependencies, keyof Transient> extends never
          ? never
          : `[Error] Key ${Key} is singleton but dependency ${Extract<
              Extract<keyof Dependencies, keyof Transient>,
              string | number
            >} is transient`);

export type RegisterScopedResult<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = Extract<
  keyof Singleton | keyof Scoped | keyof Transient,
  keyof T
> extends never
  ? RegisterScopedResultInternal<Singleton, Scoped, Transient, T>
  : `[Error] The key ${Extract<
      Extract<keyof Singleton | keyof Scoped | keyof Transient, keyof T>,
      string
    >} is already registered`;

type RegisterScopedResultInternal<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = keyof T extends never
  ? DIContainerBuilder<Singleton, Scoped & T, Transient>
  : string extends keyof T
  ? "[Error] The key must be a literal instead of any string"
  : UnionAny<keyof T> extends infer I extends keyof T
  ? I extends `_${string}`
    ? `[Error] Key ${I} cannot start with _`
    : T[I] extends DIRegistration<unknown, Partial<Record<string, unknown>>>
    ? I extends string
      ? RegisterScopedError<
          Singleton,
          Scoped,
          Transient,
          I,
          DIRegistrationToType<T[I]>,
          DIRegistrationToDependencies<T[I]>
        > extends infer Error extends string
        ? [Error] extends [never]
          ? RegisterScopedResultInternal<
              Singleton,
              Scoped & Pick<T, I>,
              Transient,
              Omit<T, I>
            >
          : Error
        : never
      : `[Error] The key ${Extract<I, string | number>} is not a string`
    : `[Error] The key ${Extract<I, string | number>} can be undefined`
  : never;

// check for existing items' dependencies and newly added item's type
type RegisterScopedError<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Type,
  Dependencies extends Partial<Record<string, unknown>>
> = {
  [K in keyof (Singleton & Scoped & Transient)]: {
    [L in keyof DIRegistrationToDependencies<
      Exclude<(Singleton & Scoped & Transient)[K], undefined>
    >]: L extends Key
      ? DIRegistrationToDependencies<
          Exclude<(Singleton & Scoped & Transient)[K], undefined>
        >[L]
      : never;
  }[keyof DIRegistrationToDependencies<
    Exclude<(Singleton & Scoped & Transient)[K], undefined>
  >];
}[keyof (Singleton & Scoped & Transient)] extends infer I
  ? [I] extends [never]
    ? RegisterScopedErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies
      >
    : Type extends I
    ? RegisterScopedErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies
      >
    : `[Error] The key ${Key} has a different type than dependencies` & {
        type: Type;
        dependencies: I;
      }
  : never;

// check for newly added item's dependencies and existing items' type and lifetime
type RegisterScopedErrorInternal<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Dependencies extends Partial<Record<string, unknown>>
> = Key extends keyof Dependencies
  ? `[Error] Key ${Key} requires self`
  :
      | {
          [K in Extract<
            keyof Dependencies,
            keyof Singleton
          >]: DIRegistrationToType<
            Exclude<Singleton[K], undefined>
          > extends Dependencies[K]
            ? never
            : `[Error] Key ${Key} has incompatible dependency: ${Extract<
                K,
                string | number
              >}`;
        }[Extract<keyof Dependencies, keyof Singleton>]
      | {
          [K in Extract<
            keyof Dependencies,
            keyof Scoped
          >]: DIRegistrationToType<
            Exclude<Scoped[K], undefined>
          > extends Dependencies[K]
            ? never
            : `[Error] Key ${Key} has incompatible dependency: ${Extract<
                K,
                string | number
              >}`;
        }[Extract<keyof Dependencies, keyof Scoped>]
      | (Extract<keyof Dependencies, keyof Transient> extends never
          ? never
          : `[Error] Key ${Key} is scoped but dependency ${Extract<
              Extract<keyof Dependencies, keyof Transient>,
              string | number
            >} is transient`)
      | {
          [K in keyof Singleton]: {
            [L in keyof DIRegistrationToDependencies<
              Exclude<Singleton[K], undefined>
            >]: L extends Key
              ? `[Error] Key ${Key} is scoped but its dependent ${L} is singleton`
              : never;
          }[keyof DIRegistrationToDependencies<
            Exclude<Singleton[K], undefined>
          >];
        }[keyof Singleton];

export type RegisterTransientResult<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = Extract<
  keyof Singleton | keyof Scoped | keyof Transient,
  keyof T
> extends never
  ? RegisterTransientResultInternal<Singleton, Scoped, Transient, T>
  : `[Error] The key ${Extract<
      Extract<keyof Singleton | keyof Scoped | keyof Transient, keyof T>,
      string
    >} is already registered`;

type RegisterTransientResultInternal<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = keyof T extends never
  ? DIContainerBuilder<Singleton, Scoped, Transient & T>
  : string extends keyof T
  ? "[Error] The key must be a literal instead of any string"
  : UnionAny<keyof T> extends infer I extends keyof T
  ? I extends `_${string}`
    ? `[Error] Key ${I} cannot start with _`
    : T[I] extends DIRegistration<unknown, Partial<Record<string, unknown>>>
    ? I extends string
      ? RegisterTransientError<
          Singleton,
          Scoped,
          Transient,
          I,
          DIRegistrationToType<T[I]>,
          DIRegistrationToDependencies<T[I]>
        > extends infer Error extends string
        ? [Error] extends [never]
          ? RegisterTransientResultInternal<
              Singleton,
              Scoped,
              Transient & Pick<T, I>,
              Omit<T, I>
            >
          : Error
        : never
      : `[Error] The key ${Extract<I, string | number>} is not a string`
    : `[Error] The key ${Extract<I, string | number>} can be undefined`
  : never;

// check for existing items' dependencies and newly added item's type
type RegisterTransientError<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Type,
  Dependencies extends Partial<Record<string, unknown>>
> = {
  [K in keyof (Singleton & Scoped & Transient)]: {
    [L in keyof DIRegistrationToDependencies<
      Exclude<(Singleton & Scoped & Transient)[K], undefined>
    >]: L extends Key
      ? DIRegistrationToDependencies<
          Exclude<(Singleton & Scoped & Transient)[K], undefined>
        >[L]
      : never;
  }[keyof DIRegistrationToDependencies<
    Exclude<(Singleton & Scoped & Transient)[K], undefined>
  >];
}[keyof (Singleton & Scoped & Transient)] extends infer I
  ? [I] extends [never]
    ? RegisterTransientErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies
      >
    : Type extends I
    ? RegisterTransientErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies
      >
    : `[Error] The key ${Key} has a different type than dependencies` & {
        type: Type;
        dependencies: I;
      }
  : never;

// check for newly added item's dependencies and existing items' type and lifetime
type RegisterTransientErrorInternal<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Dependencies extends Partial<Record<string, unknown>>
> = Key extends keyof Dependencies
  ? `[Error] Key ${Key} requires self`
  :
      | {
          [K in Extract<
            keyof Dependencies,
            keyof Singleton
          >]: DIRegistrationToType<
            Exclude<Singleton[K], undefined>
          > extends Dependencies[K]
            ? never
            : `[Error] Key ${Key} has incompatible dependency: ${Extract<
                K,
                string | number
              >}`;
        }[Extract<keyof Dependencies, keyof Singleton>]
      | {
          [K in Extract<
            keyof Dependencies,
            keyof Scoped
          >]: DIRegistrationToType<
            Exclude<Scoped[K], undefined>
          > extends Dependencies[K]
            ? never
            : `[Error] Key ${Key} has incompatible dependency: ${Extract<
                K,
                string | number
              >}`;
        }[Extract<keyof Dependencies, keyof Scoped>]
      | {
          [K in Extract<
            keyof Dependencies,
            keyof Transient
          >]: DIRegistrationToType<
            Exclude<Transient[K], undefined>
          > extends Dependencies[K]
            ? never
            : `[Error] Key ${Key} has incompatible dependency: ${Extract<
                K,
                string | number
              >}`;
        }[Extract<keyof Dependencies, keyof Transient>]
      | {
          [K in keyof Singleton]: {
            [L in keyof DIRegistrationToDependencies<
              Exclude<Singleton[K], undefined>
            >]: L extends Key
              ? `[Error] Key ${Key} is scoped but its dependent ${L} is singleton`
              : never;
          }[keyof DIRegistrationToDependencies<
            Exclude<Singleton[K], undefined>
          >];
        }[keyof Singleton]
      | {
          [K in keyof Scoped]: {
            [L in keyof DIRegistrationToDependencies<
              Exclude<Scoped[K], undefined>
            >]: L extends Key
              ? `[Error] Key ${Key} is transient but its dependent ${L} is scoped`
              : never;
          }[keyof DIRegistrationToDependencies<Exclude<Scoped[K], undefined>>];
        }[keyof Scoped];

export interface DIContainerBase<T> {
  _scope: () => DIContainer<T>;
}

export type DIContainer<T> = T & DIContainerBase<T>;

export type BuildResult<
  Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = DIContainer<
  Pick<
    RegistrationMapToInstanceMap<Singleton & Scoped & Transient>,
    ResolvedKeys<Singleton & Scoped & Transient, never>
  >
>;

type ResolvedKeys<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  AlreadyResolvedKeys extends keyof Map
> = TryResolveAnyKey<Map, AlreadyResolvedKeys> extends infer I extends keyof Map
  ? [I] extends [never]
    ? AlreadyResolvedKeys
    : ResolvedKeys<Map, AlreadyResolvedKeys | I>
  : never;

// resolves to any newly resolvable key
type TryResolveAnyKey<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  ResolvedKeys extends keyof Map
> = {
  [K in keyof Map]: true extends {
    [L in keyof DIRegistrationToDependencies<
      Exclude<Map[K], undefined>
    >]: L extends ResolvedKeys ? never : true; // true if any of dependency is not resolved
  }[keyof DIRegistrationToDependencies<Exclude<Map[K], undefined>>]
    ? never
    : K;
}[Exclude<keyof Map, ResolvedKeys>];

export class DIContainerBuilder<
  const Singleton extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  const Scoped extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  const Transient extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> {
  private constructor(
    private readonly singleton: Singleton,
    private readonly scoped: Scoped,
    private readonly transient: Transient
  ) {}

  public static registerSingleton<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterSingletonResult<{}, {}, {}, T>;
  public static registerSingleton<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder(items, {}, {});
  }

  public static registerScoped<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterScopedResult<{}, {}, {}, T>;
  public static registerScoped<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder({}, items, {});
  }

  public static registerTransient<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterTransientResult<{}, {}, {}, T>;
  public static registerTransient<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder({}, {}, items);
  }

  public registerSingleton<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterSingletonResult<Singleton, Scoped, Transient, T>;
  public registerSingleton<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder(
      { ...this.singleton, ...items },
      this.scoped,
      this.transient
    );
  }

  public registerScoped<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterScopedResult<Singleton, Scoped, Transient, T>;
  public registerScoped<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder(
      this.singleton,
      { ...this.scoped, ...items },
      this.transient
    );
  }

  public registerTransient<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterTransientResult<Singleton, Scoped, Transient, T>;
  public registerTransient<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder(this.singleton, this.scoped, {
      ...this.transient,
      ...items,
    });
  }

  public build(): BuildResult<Singleton, Scoped, Transient>;
  public build(): unknown {
    const singletonInstances: Partial<RegistrationMapToInstanceMap<Singleton>> =
      {};
    const resolving: Partial<Record<keyof Singleton, true>> = {};
    const scope = () => {
      const scopedInstances: Partial<RegistrationMapToInstanceMap<Scoped>> = {};
      let proxy: RegistrationMapToInstanceMap<Singleton & Scoped & Transient>;
      const resolve = <
        const K extends Extract<keyof (Singleton & Scoped & Transient), string>
      >(
        key: K
      ): RegistrationMapToInstanceMap<Singleton & Scoped & Transient>[K] => {
        if (this.singleton[key]) {
          if (singletonInstances[key] !== undefined) {
            return singletonInstances[
              key
            ] as RegistrationMapToInstanceMap<Singleton>[K];
          }
          if (resolving[key]) {
            throw new CircularDependencyError(
              `Circular dependency detected: ${key}`,
              key
            );
          }
          resolving[key] = true;
          const result = this.singleton[key]!.instantiate(
            proxy
          ) as RegistrationMapToInstanceMap<Singleton>[K];
          singletonInstances[key] = result;
          delete resolving[key];
          return result;
        } else if (this.scoped[key]) {
          if (scopedInstances[key] !== undefined) {
            return scopedInstances[
              key
            ] as RegistrationMapToInstanceMap<Scoped>[K];
          }
          if (resolving[key]) {
            throw new CircularDependencyError(
              `Circular dependency detected: ${key}`,
              key
            );
          }
          resolving[key] = true;
          const result = this.scoped[key]!.instantiate(
            proxy
          ) as RegistrationMapToInstanceMap<Scoped>[K];
          scopedInstances[key] = result;
          delete resolving[key];
          return result;
        } else if (this.transient[key]) {
          return this.transient[key]!.instantiate(
            proxy
          ) as RegistrationMapToInstanceMap<Transient>[K];
        } else {
          throw new Error(`Key ${key} not found`);
        }
      };
      proxy = new Proxy(singletonInstances, {
        get(target, key) {
          if (key === "_scope") {
            return scope;
          }
          return resolve(key as Extract<keyof Singleton, string>);
        },
      }) as RegistrationMapToInstanceMap<Singleton & Scoped & Transient>;
      return proxy;
    };
    return scope();
  }
}

export const fromClass = DIRegistration.fromClass;
export const fromFunction = DIRegistration.fromFunction;
export const fromValue = DIRegistration.fromValue;
export const registerSingleton = DIContainerBuilder.registerSingleton;
export const registerScoped = DIContainerBuilder.registerScoped;
export const registerTransient = DIContainerBuilder.registerTransient;
