import {
  IAction,
  IActionKind,
  IApi,
  IApiHandler,
  IFeature,
  IHandler,
  IHandlers,
  IKind,
  INone,
  IUseKind,
  IUseType,
  Kind,
} from './index';

const DEFAULT_OTHERWISE = (input: any) => {
  throw new Error(`No handler for ${JSON.stringify(input)}`);
};

function make<
  K extends Kind,
  Input extends IAction,
  Next extends IAction | INone,
>(kind: K) {
  return <I extends Extract<Input, IKind<K>>['type']>(
    type: I,
    handler: IApiHandler<IUseType<Input, I>, Next extends INone ? Input : Next>,
  ): IHandlers<IUseType<Input, I>, Next extends INone ? Input : Next> => {
    const h = {
      kind: kind as IUseKind<IUseType<Input, I>>,
      type,
      handler,
    } as IHandler<IUseType<Input, I>, Next>;
    return {
      [type]: h,
      [`_${type}_${
        Math.random().toString(16).slice(2) +
        Math.random().toString(16).slice(2)
      }`]: h,
    } as IHandlers<IUseType<Input, I>, Next extends INone ? Input : Next>;
  };
}

export type IFeatureApi<
  Input extends IAction,
  Next extends IAction | INone = INone,
> = Next extends INone ? IApi<Input> : IApiHandler<Input, Next>;

export function Feature<
  Input extends IAction,
  Next extends IAction | INone = INone,
>(): IFeature<Input, Next> {
  let eventHandlerMap:
    | Record<Input['type'], IApiHandler<Input, Next>[]>
    | undefined = undefined;

  return {
    [Kind.command]: make<Kind.command, Input, Next>(Kind.command),
    [Kind.query]: make<Kind.query, Input, Next>(Kind.query),
    [Kind.event]: make<Kind.event, Input, Next>(Kind.event),
    [Kind.rejection]: make<Kind.rejection, Input, Next>(Kind.rejection),
    [Kind.notification]: make<Kind.notification, Input, Next>(
      Kind.notification,
    ),
    [Kind.error]: make<Kind.error, Input, Next>(Kind.error),

    Handlers: (handlers) => handlers,
    Api: (
      handlers,
      otherwise = DEFAULT_OTHERWISE,
    ): IFeatureApi<Input, Next> => {
      const api: IFeatureApi<Input, Next> = (async (input, next) => {
        if (input instanceof Object && (handlers as any)[input.type]) {
          const h: IHandler<Input, Next> = (handlers as any)[
            input.type
          ] as IHandler<Input, Next>;

          if (h.kind === Kind.command || h.kind === Kind.query) {
            // simply handle the command/query
            return h.handler(input, (next || api) as any);
          } else {
            // build event handler map
            if (!eventHandlerMap) {
              const uniqueHandlers = Array.from(
                new Set(Object.values(handlers) as IHandler<Input, Next>[]),
              );

              eventHandlerMap = uniqueHandlers.reduce((a, v) => {
                const actionHandlers = a[v.type] || [];
                actionHandlers.push(v.handler);
                return {
                  ...a,
                  [v.type]: actionHandlers,
                };
              }, {} as Record<Input['type'], IApiHandler<Input, Next>[]>);
            }

            // execute all event handlers
            if (eventHandlerMap) {
              const eventHandlers: IApiHandler<Input, Next>[] =
                (eventHandlerMap as any)[input.type] || [];

              if (eventHandlers) {
                await Promise.all(
                  eventHandlers.map((h) => h(input, (next || api) as any)),
                );
              }
            }
          }
        } else {
          return otherwise(input, (next || api) as any);
        }
      }) as IFeatureApi<Input, Next>;

      return api;
    },
    NextApi: (next) => next,
    GetKind: (handlers) => (input: any) => {
      if (input instanceof Object && (handlers as any)[input.type]) {
        const h: IHandler<Input, Next> = (handlers as any)[
          input.type
        ] as IHandler<Input, Next>;

        return h.kind as IActionKind;
      } else {
        return Kind.none;
      }
    },
  };
}

export function Never(_: never): never {
  let value = 'UNKNOWN';

  try {
    value = JSON.stringify(_);
  } catch {}

  throw new Error(`Never: ${value}`);
}
