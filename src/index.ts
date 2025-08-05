export type DILifetime = "singleton" | "scoped" | "transient";

export abstract class DIRegistration<
  Self,
  const Dependencies extends Partial<Record<string, unknown>>,
  Lifetime extends DILifetime
> {
  public abstract instantiate(dependencies: Dependencies): Self;
  private constructor(public lifetime: Lifetime) {}

  public static fromClass<Self>(
    cls: new () => Self
  ): DIRegistration<Self, {}, "singleton">;
  public static fromClass<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(
    cls: new (deps: Dependencies) => Self
  ): DIRegistration<Self, Dependencies, "singleton">;
  public static fromClass<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(
    cls: new (deps: Dependencies) => Self
  ): DIRegistration<Self, Dependencies, "singleton"> {
    return new (class extends DIRegistration<Self, Dependencies, "singleton"> {
      constructor() {
        super("singleton");
      }
      instantiate(dependencies: Dependencies) {
        return new cls(dependencies);
      }
    })();
  }

  public static fromFunction<Self>(
    func: () => Self
  ): DIRegistration<Self, {}, "singleton">;
  public static fromFunction<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(
    func: (deps: Dependencies) => Self
  ): DIRegistration<Self, Dependencies, "singleton">;
  public static fromFunction<
    Self,
    const Dependencies extends Partial<Record<string, unknown>>
  >(
    func: (deps: Dependencies) => Self
  ): DIRegistration<Self, Dependencies, "singleton"> {
    return new (class extends DIRegistration<Self, Dependencies, "singleton"> {
      constructor() {
        super("singleton");
      }
      instantiate(dependencies: Dependencies) {
        return func(dependencies);
      }
    })();
  }

  public static fromValue<Self>(
    value: Self
  ): DIRegistration<Self, {}, "singleton"> {
    return new (class extends DIRegistration<Self, {}, "singleton"> {
      constructor() {
        super("singleton");
      }
      instantiate() {
        return value;
      }
    })();
  }

  public singleton(): DIRegistration<Self, Dependencies, "singleton"> {
    const self = this;
    return new (class extends DIRegistration<Self, Dependencies, "singleton"> {
      constructor() {
        super("singleton");
      }
      instantiate(dependencies: Dependencies) {
        return self.instantiate(dependencies);
      }
    })();
  }

  public scoped(): DIRegistration<Self, Dependencies, "scoped"> {
    const self = this;
    return new (class extends DIRegistration<Self, Dependencies, "scoped"> {
      constructor() {
        super("scoped");
      }
      instantiate(dependencies: Dependencies) {
        return self.instantiate(dependencies);
      }
    })();
  }

  public transient(): DIRegistration<Self, Dependencies, "transient"> {
    const self = this;
    return new (class extends DIRegistration<Self, Dependencies, "transient"> {
      constructor() {
        super("transient");
      }
      instantiate(dependencies: Dependencies) {
        return self.instantiate(dependencies);
      }
    })();
  }
}

export type DIRegistrationToType<
  T extends DIRegistration<
    unknown,
    Partial<Record<string, unknown>>,
    DILifetime
  >
> = T extends DIRegistration<
  infer I,
  Partial<Record<string, unknown>>,
  DILifetime
>
  ? I
  : never;

export type DIRegistrationToDependencies<
  T extends DIRegistration<
    unknown,
    Partial<Record<string, unknown>>,
    DILifetime
  >
> = T extends DIRegistration<unknown, infer I, DILifetime> ? I : never;

export type DIRegistrationToLifetime<
  T extends DIRegistration<
    unknown,
    Partial<Record<string, unknown>>,
    DILifetime
  >
> = T extends DIRegistration<
  unknown,
  Partial<Record<string, unknown>>,
  infer I extends DILifetime
>
  ? I
  : never;

export type DIRegistrationMapToInstanceMap<
  Map extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
  >
> = {
  [K in keyof Map]-?: DIRegistrationToInstance<Exclude<Map[K], undefined>>;
};

export type DIRegistrationToInstance<
  T extends DIRegistration<
    unknown,
    Partial<Record<string, unknown>>,
    DILifetime
  >
> = T extends DIRegistration<
  infer I,
  Partial<Record<string, unknown>>,
  DILifetime
>
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

export type RegisterResult<
  Singleton extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
    >
  >,
  Scoped extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
    >
  >,
  Transient extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
    >
  >,
  T extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
  >
> = Extract<
  keyof Singleton | keyof Scoped | keyof Transient,
  keyof T
> extends never
  ? RegisterResultInternal<Singleton, Scoped, Transient, T>
  : `[Error] The key ${Extract<
      Extract<keyof Singleton | keyof Scoped | keyof Transient, keyof T>,
      string
    >} is already registered`;

type RegisterResultInternal<
  Singleton extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
    >
  >,
  Scoped extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
    >
  >,
  Transient extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
    >
  >,
  T extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
  >
> = keyof T extends never
  ? DIContainerBuilder<Singleton, Scoped, Transient>
  : string extends keyof T
  ? "[Error] The key must be a literal instead of any string"
  : UnionAny<keyof T> extends infer I extends keyof T
  ? I extends `_${string}`
    ? `[Error] Key ${I} cannot start with _`
    : T[I] extends DIRegistration<
        unknown,
        Partial<Record<string, unknown>>,
        DILifetime
      >
    ? I extends string
      ? RegisterError<
          Singleton,
          Scoped,
          Transient,
          I,
          DIRegistrationToType<T[I]>,
          DIRegistrationToDependencies<T[I]>,
          DIRegistrationToLifetime<T[I]>
        > extends infer Error extends string
        ? [Error] extends [never]
          ? RegisterResultInternal<
              Singleton &
                (DIRegistrationToLifetime<T[I]> extends "singleton"
                  ? Pick<T, I>
                  : {}),
              Scoped &
                (DIRegistrationToLifetime<T[I]> extends "scoped"
                  ? Pick<T, I>
                  : {}),
              Transient &
                (DIRegistrationToLifetime<T[I]> extends "transient"
                  ? Pick<T, I>
                  : {}),
              Omit<T, I>
            >
          : Error
        : never
      : `[Error] The key ${Extract<I, string | number>} is not a string`
    : `[Error] The key ${Extract<I, string | number>} can be undefined`
  : never;

// check for existing items' dependencies and newly added item's type
type RegisterError<
  Singleton extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
    >
  >,
  Scoped extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
    >
  >,
  Transient extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
    >
  >,
  Key extends string,
  Type,
  Dependencies extends Partial<Record<string, unknown>>,
  Lifetime extends DILifetime
> = UnionToIntersection<Lifetime> extends never
  ? `[Error] Lifetime ${Lifetime} is not a valid lifetime`
  :
      | {
          [K in keyof Singleton]: {
            [L in keyof DIRegistrationToDependencies<
              Exclude<Singleton[K], undefined>
            >]: L extends Key
              ? DIRegistrationToDependencies<
                  Exclude<Singleton[K], undefined>
                >[L]
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
              ? DIRegistrationToDependencies<Exclude<Scoped[K], undefined>>[L]
              : never;
          }[keyof DIRegistrationToDependencies<Exclude<Scoped[K], undefined>>];
        }[keyof Scoped]
      | {
          [K in keyof Transient]: {
            [L in keyof DIRegistrationToDependencies<
              Exclude<Transient[K], undefined>
            >]: L extends Key
              ? DIRegistrationToDependencies<
                  Exclude<Transient[K], undefined>
                >[L]
              : never;
          }[keyof DIRegistrationToDependencies<
            Exclude<Transient[K], undefined>
          >];
        }[keyof Transient] extends infer I
  ? [I] extends [never]
    ? RegisterErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies,
        Lifetime
      >
    : Type extends I
    ? RegisterErrorInternal<
        Singleton,
        Scoped,
        Transient,
        Key,
        Dependencies,
        Lifetime
      >
    : `[Error] The key ${Key} has a different type than dependencies` & {
        type: Type;
        dependencies: I;
      }
  : never;

// check for newly added item's dependencies and existing items' type and lifetime
type RegisterErrorInternal<
  Singleton extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
    >
  >,
  Scoped extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
    >
  >,
  Transient extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
    >
  >,
  Key extends string,
  Dependencies extends Partial<Record<string, unknown>>,
  Lifetime extends DILifetime
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
          : Lifetime extends "singleton"
          ? `[Error] Key ${Key} is singleton but dependency ${Extract<
              Extract<keyof Dependencies, keyof Scoped>,
              string | number
            >} is scoped`
          : never)
      | (Extract<keyof Dependencies, keyof Transient> extends never
          ? never
          : Lifetime extends "singleton" | "scoped"
          ? `[Error] Key ${Key} is ${Lifetime} but dependency ${Extract<
              Extract<keyof Dependencies, keyof Transient>,
              string | number
            >} is transient`
          : never)
      | (Lifetime extends "scoped" | "transient"
          ? {
              [K in keyof Singleton]: {
                [L in keyof DIRegistrationToDependencies<
                  Exclude<Singleton[K], undefined>
                >]: L extends Key
                  ? `[Error] Key ${Key} is ${Lifetime} but its dependent ${L} is singleton`
                  : never;
              }[keyof DIRegistrationToDependencies<
                Exclude<Singleton[K], undefined>
              >];
            }[keyof Singleton]
          : never)
      | (Lifetime extends "transient"
          ? {
              [K in keyof Scoped]: {
                [L in keyof DIRegistrationToDependencies<
                  Exclude<Scoped[K], undefined>
                >]: L extends Key
                  ? `[Error] Key ${Key} is transient but its dependent ${L} is scoped`
                  : never;
              }[keyof DIRegistrationToDependencies<
                Exclude<Scoped[K], undefined>
              >];
            }[keyof Scoped]
          : never);

export interface DIContainerBase<T> {
  readonly _scope: () => DIContainer<T>;
}

export type DIContainer<T> = T & DIContainerBase<T>;

export type BuildResult<
  Singleton extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
    >
  >,
  Scoped extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
    >
  >,
  Transient extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
    >
  >
> = DIContainer<
  Pick<
    DIRegistrationMapToInstanceMap<Singleton & Scoped & Transient>,
    ResolvedKeys<Singleton & Scoped & Transient, never>
  >
>;

type ResolvedKeys<
  Map extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
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
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
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

type Internal<T> = {
  [K in keyof T]?: [T[K]];
};

export class DIContainerBuilder<
  const Singleton extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
    >
  >,
  const Scoped extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
    >
  >,
  const Transient extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
    >
  >
> {
  private constructor(
    private readonly singleton: Singleton,
    private readonly scoped: Scoped,
    private readonly transient: Transient
  ) {}

  public static register<
    const T extends Partial<
      Record<
        string,
        DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
      >
    >
  >(items: T): RegisterResult<{}, {}, {}, T>;
  public static register<
    const T extends Partial<
      Record<
        string,
        DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
      >
    >
  >(items: T): unknown {
    return new DIContainerBuilder(
      Object.fromEntries(
        Object.entries(items).filter(
          (
            entry
          ): entry is [
            key: string,
            value: DIRegistration<
              unknown,
              Partial<Record<string, unknown>>,
              "singleton"
            >
          ] => entry[1]!.lifetime === "singleton"
        )
      ),
      Object.fromEntries(
        Object.entries(items).filter(
          (
            entry
          ): entry is [
            key: string,
            value: DIRegistration<
              unknown,
              Partial<Record<string, unknown>>,
              "scoped"
            >
          ] => entry[1]!.lifetime === "scoped"
        )
      ),
      Object.fromEntries(
        Object.entries(items).filter(
          (
            entry
          ): entry is [
            key: string,
            value: DIRegistration<
              unknown,
              Partial<Record<string, unknown>>,
              "transient"
            >
          ] => entry[1]!.lifetime === "transient"
        )
      )
    );
  }

  public register<
    const T extends Partial<
      Record<
        string,
        DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
      >
    >
  >(items: T): RegisterResult<Singleton, Scoped, Transient, T>;
  public register<
    const T extends Partial<
      Record<
        string,
        DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
      >
    >
  >(items: T): unknown {
    return new DIContainerBuilder(
      {
        ...this.singleton,
        ...Object.fromEntries(
          Object.entries(items).filter(
            (
              entry
            ): entry is [
              key: string,
              value: DIRegistration<
                unknown,
                Partial<Record<string, unknown>>,
                "singleton"
              >
            ] => entry[1]!.lifetime === "singleton"
          )
        ),
      },
      {
        ...this.scoped,
        ...Object.fromEntries(
          Object.entries(items).filter(
            (
              entry
            ): entry is [
              key: string,
              value: DIRegistration<
                unknown,
                Partial<Record<string, unknown>>,
                "scoped"
              >
            ] => entry[1]!.lifetime === "scoped"
          )
        ),
      },
      {
        ...this.transient,
        ...Object.fromEntries(
          Object.entries(items).filter(
            (
              entry
            ): entry is [
              key: string,
              value: DIRegistration<
                unknown,
                Partial<Record<string, unknown>>,
                "transient"
              >
            ] => entry[1]!.lifetime === "transient"
          )
        ),
      }
    );
  }

  public build(): BuildResult<Singleton, Scoped, Transient>;
  public build(): unknown {
    const singletonInstances: Internal<
      DIRegistrationMapToInstanceMap<Singleton>
    > = {};
    const resolving: Partial<Record<keyof Singleton, true>> = {};
    const scope = () => {
      const scopedInstances: Internal<DIRegistrationMapToInstanceMap<Scoped>> =
        {};
      let proxy: DIRegistrationMapToInstanceMap<Singleton & Scoped & Transient>;
      const resolve = <
        const K extends Extract<keyof (Singleton & Scoped & Transient), string>
      >(
        key: K
      ): DIRegistrationMapToInstanceMap<Singleton & Scoped & Transient>[K] => {
        if (this.singleton[key]) {
          if (singletonInstances[key] !== undefined) {
            return singletonInstances[
              key
            ][0] as DIRegistrationMapToInstanceMap<Singleton>[K];
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
          ) as DIRegistrationMapToInstanceMap<Singleton>[K];
          singletonInstances[key] = [result];
          delete resolving[key];
          return result;
        } else if (this.scoped[key]) {
          if (scopedInstances[key] !== undefined) {
            return scopedInstances[
              key
            ][0] as DIRegistrationMapToInstanceMap<Scoped>[K];
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
          ) as DIRegistrationMapToInstanceMap<Scoped>[K];
          scopedInstances[key] = [result];
          delete resolving[key];
          return result;
        } else if (this.transient[key]) {
          return this.transient[key]!.instantiate(
            proxy
          ) as DIRegistrationMapToInstanceMap<Transient>[K];
        } else {
          throw new Error(`Key ${key} not found`);
        }
      };
      proxy = new Proxy(
        {},
        {
          get(_target, key) {
            if (key === "_scope") {
              return scope;
            }
            return resolve(key as Extract<keyof Singleton, string>);
          },
        }
      ) as DIRegistrationMapToInstanceMap<Singleton & Scoped & Transient>;
      return proxy;
    };
    return scope();
  }
}

export const fromClass = DIRegistration.fromClass;
export const fromFunction = DIRegistration.fromFunction;
export const fromValue = DIRegistration.fromValue;
export const register = DIContainerBuilder.register;

export type UnresolvedKeys<
  ContainerBuilder,
  ToResolve extends ContainerBuilder extends DIContainerBuilder<
    infer I extends Partial<
      Record<
        string,
        DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
      >
    >,
    infer J extends Partial<
      Record<
        string,
        DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
      >
    >,
    infer K extends Partial<
      Record<
        string,
        DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
      >
    >
  >
    ? keyof (I & J & K)
    : never
> = ContainerBuilder extends DIContainerBuilder<
  infer I extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "singleton">
    >
  >,
  infer J extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "scoped">
    >
  >,
  infer K extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, "transient">
    >
  >
>
  ? UnresolvedKeysForMap<I & J & K, ToResolve>
  : never;

export type UnresolvedKeysForMap<
  Map extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
  >,
  ToResolve extends keyof Map
> = UnresolvedKeysInternal<
  Map,
  ToResolve,
  Extract<
    keyof DIRegistrationToDependencies<Exclude<Map[ToResolve], undefined>>,
    string
  >
>;

type UnresolvedKeysInternal<
  Map extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
  >,
  Resolved extends keyof Map,
  Unresolved extends string
> = TryResolve<Map, Resolved, Unresolved> extends [
  infer I extends keyof Map,
  infer J extends string
]
  ? [I] extends [never]
    ? J
    : UnresolvedKeysInternal<Map, Resolved | I, J>
  : never;

// consumes Unresolved, resolves to [newly resolved keys, unresolved keys]
type TryResolve<
  Map extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
  >,
  Resolved extends keyof Map,
  Unresolved extends string
> = TryResolveInternal<
  Map,
  Resolved,
  Unresolved,
  Exclude<
    | {
        [K in Extract<keyof Map, Unresolved>]: Extract<
          keyof DIRegistrationToDependencies<Exclude<Map[K], undefined>>,
          keyof Map
        >;
      }[Extract<keyof Map, Unresolved>]
    | Extract<keyof Map, Unresolved>,
    Resolved
  >
>;

type TryResolveInternal<
  Map extends Partial<
    Record<
      string,
      DIRegistration<unknown, Partial<Record<string, unknown>>, DILifetime>
    >
  >,
  Resolved extends keyof Map,
  Unresolved extends string,
  NewlyResolvedKeys extends keyof Map
> = [
  newlyResolvedKeys: NewlyResolvedKeys,
  unresolvedKeys: Exclude<
    | {
        [K in Extract<keyof Map, Unresolved>]: Exclude<
          keyof DIRegistrationToDependencies<Exclude<Map[K], undefined>>,
          keyof Map
        >;
      }[Extract<keyof Map, Unresolved>]
    | Unresolved,
    Resolved | NewlyResolvedKeys
  >
];
