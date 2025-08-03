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

export type RegisterResult<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = Extract<keyof Map, keyof T> extends never
  ? RegisterResultInternal<Map, T>
  : `[Error] The key ${Extract<
      Extract<keyof Map, keyof T>,
      string
    >} is already registered`;

type RegisterResultInternal<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  T extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = keyof T extends never
  ? DIContainerBuilder<Map & T>
  : string extends keyof T
  ? `[Error] The key must be a literal instead of any string`
  : UnionAny<keyof T> extends infer I extends keyof T
  ? T[I] extends DIRegistration<unknown, Partial<Record<string, unknown>>>
    ? I extends string
      ? RegisterError<
          Map,
          I,
          DIRegistrationToType<T[I]>,
          DIRegistrationToDependencies<T[I]>
        > extends infer Error extends string
        ? [Error] extends [never]
          ? RegisterResultInternal<Map & Pick<T, I>, Omit<T, I>>
          : Error
        : never
      : `[Error] The key ${Extract<I, string | number>} is not a string`
    : `[Error] The key ${Extract<I, string | number>} can be undefined`
  : never;

// check for existing items' dependencies and newly added item's type
type RegisterError<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Type,
  Dependencies extends Partial<Record<string, unknown>>
> = Key extends keyof Map
  ? `[Error] The key ${Key} is already registered`
  : {
      [K in keyof Map]: {
        [L in keyof DIRegistrationToDependencies<
          Exclude<Map[K], undefined>
        >]: L extends Key
          ? DIRegistrationToDependencies<Exclude<Map[K], undefined>>[L]
          : never;
      }[keyof DIRegistrationToDependencies<Exclude<Map[K], undefined>>];
    }[keyof Map] extends infer I
  ? I extends never
    ? RegisterErrorInternal<Map, Key, Dependencies>
    : Type extends I
    ? RegisterErrorInternal<Map, Key, Dependencies>
    : `[Error] The key ${Key} has a different type than dependencies` & {
        type: Type;
        dependencies: I;
      }
  : never;

// check for newly added item's dependencies and existing items' type
type RegisterErrorInternal<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >,
  Key extends string,
  Dependencies extends Partial<Record<string, unknown>>
> = Key extends keyof Dependencies
  ? `[Error] Key ${Key} requires self`
  : {
      [K in Extract<keyof Dependencies, keyof Map>]: DIRegistrationToType<
        Exclude<Map[K], undefined>
      > extends Dependencies[K]
        ? never
        : `[Error] Key ${Key} has incompatible dependency: ${Extract<
            K,
            string | number
          >}`;
    }[Extract<keyof Dependencies, keyof Map>];

export type BuildResult<
  Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> = Pick<RegistrationMapToInstanceMap<Map>, ResolvedKeys<Map, never>>;

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
  const Map extends Partial<
    Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
  >
> {
  private constructor(private readonly items: Map) {}

  public static register<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterResult<{}, T>;
  public static register<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder(items);
  }

  public register<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): RegisterResult<Map, T>;
  public register<
    const T extends Partial<
      Record<string, DIRegistration<unknown, Partial<Record<string, unknown>>>>
    >
  >(items: T): unknown {
    return new DIContainerBuilder({ ...this.items, ...items });
  }

  public build(): BuildResult<Map>;
  public build(): unknown {
    const instances: Partial<RegistrationMapToInstanceMap<Map>> = {};
    const resolving: Partial<Record<keyof Map, true>> = {};
    let proxy: RegistrationMapToInstanceMap<Map>;
    const resolve = <const K extends Extract<keyof Map, string>>(
      key: K
    ): RegistrationMapToInstanceMap<Map>[K] => {
      if (instances[key] !== undefined) {
        return instances[key] as RegistrationMapToInstanceMap<Map>[K];
      }
      if (resolving[key]) {
        throw new CircularDependencyError(
          `Circular dependency detected: ${key}`,
          key
        );
      }
      resolving[key] = true;
      const result = this.items[key]!.instantiate(
        proxy
      ) as RegistrationMapToInstanceMap<Map>[K];
      instances[key] = result;
      delete resolving[key];
      return result;
    };
    proxy = new Proxy(instances, {
      get(target, key) {
        return resolve(key as Extract<keyof Map, string>);
      },
    }) as RegistrationMapToInstanceMap<Map>;
    return proxy;
  }
}
