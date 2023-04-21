import {
  IAction,
  IActionHandler,
  IActionKind,
  IApi,
  IFeature,
  IGetKind,
  IHandler,
  IHandlers,
  INone,
  IPromise,
  IUseKind,
  IUseType,
  Kind,
} from './index';

const DEFAULT_OTHERWISE = (input: any) => {
  throw new Error(`NO_HANDLER: ${JSON.stringify(input)}`);
};

function createHandler<
  K extends Kind,
  Input extends IAction,
  Imports extends IAction | INone,
>(kind: K) {
  return <I extends IUseKind<Input, K>['type']>(
    type: I,
    handler: IActionHandler<IUseType<Input, I>, Input | Imports>,
  ): IHandlers<IUseType<Input, I>, Input | Imports> => {
    const id =
      Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);

    const h = {
      kind: kind as IGetKind<IUseType<Input, I>>,
      type,
      handler,
    } as IHandler<IUseType<Input, I>, Input | Imports>;

    return {
      [type]: h,
      [`_${type}_${id}`]: h,
    } as IHandlers<IUseType<Input, I>, Input | Imports>;
  };
}

let FEATURE: undefined | IFeature<IAction> = undefined;

export function Feature<
  Input extends IAction,
  Imports extends IAction | INone = INone,
>(): IFeature<Input, Imports> {
  if (!FEATURE) {
    const feature: IFeature<Input, Imports> = {
      [Kind.command]: createHandler<Kind.command, Input, Imports>(Kind.command),
      [Kind.query]: createHandler<Kind.query, Input, Imports>(Kind.query),
      [Kind.event]: createHandler<Kind.event, Input, Imports>(Kind.event),
      [Kind.rejection]: createHandler<Kind.rejection, Input, Imports>(
        Kind.rejection,
      ),
      [Kind.notification]: createHandler<Kind.notification, Input, Imports>(
        Kind.notification,
      ),
      [Kind.error]: createHandler<Kind.error, Input, Imports>(Kind.error),

      handlers: (handlers) => handlers,
    };

    FEATURE = feature as any;
  }

  return FEATURE as any as IFeature<Input, Imports>;
}

export function Api<
  Input extends IAction,
  Imports extends IAction | INone = INone,
>(
  handlers: IHandlers<Input, Imports>,
  listener?: (input: Input | Imports) => IPromise<void>,
  otherwise: (input: any) => IPromise<any> = DEFAULT_OTHERWISE,
): IApi<Input> {
  let eventHandlerMap:
    | Record<Input['type'], IActionHandler<Input, Imports>[]>
    | undefined = undefined;

  const api: IActionHandler<Input, Imports> = async (input, next) => {
    if (listener) {
      await listener(input);
    }

    if (input instanceof Object && (handlers as any)[input.type]) {
      const h: IHandler<Input, Imports> = (handlers as any)[
        input.type
      ] as IHandler<Input, Imports>;

      if (h.kind === Kind.command || h.kind === Kind.query) {
        // simply handle the command/query
        return h.handler(input, (next || api) as any);
      } else {
        // build event handler map
        if (!eventHandlerMap) {
          const uniqueHandlers = Array.from(
            new Set(Object.values(handlers) as IHandler<Input, Imports>[]),
          );

          eventHandlerMap = uniqueHandlers.reduce((a, v) => {
            const actionHandlers = a[v.type] || [];
            actionHandlers.push(v.handler);
            return {
              ...a,
              [v.type]: actionHandlers,
            };
          }, {} as Record<Input['type'], IActionHandler<Input, Imports>[]>);
        }

        // execute all event handlers
        const eventHandlers: IActionHandler<Input, Imports>[] =
          (eventHandlerMap as any)[input.type] || [];

        if (eventHandlers) {
          await Promise.all(
            eventHandlers.map((h) => h(input, (next || api) as any)),
          );

          return null as any;
        }
      }
    } else {
      return otherwise(input);
    }
  };

  return (input) => api(input, api as any);
}

export function GetKind<
  Handlers extends { [P in any]: { kind: any } | undefined | void },
>(handlers: Handlers) {
  if (!(handlers instanceof Object)) {
    throw new Error('handlers must be an object');
  }

  return (input: any): IActionKind | Kind.none => {
    if (
      input instanceof Object &&
      input.type &&
      (handlers as any)[input.type]
    ) {
      const h: IHandler<IAction, INone> = (handlers as any)[
        input.type
      ] as IHandler<IAction, INone>;

      return (h?.kind as IActionKind) || Kind.none;
    } else {
      return Kind.none;
    }
  };
}

export function Nothing(...args: any[]): any {
  return null;
}

export function Never(_: never): never {
  let value = 'UNKNOWN';

  try {
    value = JSON.stringify(_);
  } catch {}

  throw new Error(`Never: ${value}`);
}
