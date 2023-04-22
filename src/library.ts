import {
  IAction,
  IActionHandler,
  IActionKind,
  IApi,
  IError,
  IFeature,
  IGetKind,
  IHandler,
  IHandlers,
  INone,
  IPromise,
  IType,
  IUseKind,
  IUseType,
  Kind,
} from './index.type';

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
    const h = {
      kind: kind as IGetKind<IUseType<Input, I>>,
      type,
      handler,
    } as IHandler<IUseType<Input, I>, Input | Imports>;

    if (kind === Kind.command || kind === Kind.query) {
      return {
        [type]: h,
      } as IHandlers<IUseType<Input, I>, Input | Imports>;
    } else {
      const id =
        Math.random().toString(16).slice(2) +
        Math.random().toString(16).slice(2);

      return {
        [type]: h,
        [`_${type}_${id}`]: h,
      } as IHandlers<IUseType<Input, I>, Input | Imports>;
    }
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

  const apiV1: IActionHandler<Input, Imports> = async (input, next) => {
    if (
      input instanceof Object &&
      input.type &&
      (handlers as any)[input.type]
    ) {
      if (listener) {
        await listener(input);
      }

      const h: IHandler<Input, Imports> = (handlers as any)[
        input.type
      ] as IHandler<Input, Imports>;

      if (h.kind === Kind.command || h.kind === Kind.query) {
        // simply handle the command/query
        return h.handler(input, (next || apiV1) as any);
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

        await Promise.all(
          eventHandlers.map((h) => h(input, (next || apiV1) as any)),
        );

        return null as any;
      }
    } else {
      return otherwise(input);
    }
  };

  return (input, overrides) => {
    if (overrides) {
      const apiV2: IActionHandler<Input, Imports> = async (input, next) => {
        if (
          overrides instanceof Object &&
          input.type &&
          (overrides as any)[input.type]
        ) {
          const h: IHandler<Input, Imports> = (overrides as any)[
            input.type
          ] as IHandler<Input, Imports>;

          if (h.kind === Kind.command || h.kind === Kind.query) {
            if (listener) {
              await listener(input);
            }

            return h.handler(input, (next || apiV2) as any);
          } else {
            // TODO: add support for events to be overridden
            return apiV1(input, apiV2 as any);
          }
        } else {
          return apiV1(input, apiV2 as any);
        }
      };
      return apiV2(input, apiV2 as any);
    } else {
      return apiV1(input, apiV1 as any);
    }
  };
}

export function Handlers<
  Input extends IAction,
  Imports extends IAction | INone = INone,
>(handlers: IHandlers<Input, Imports>): IHandlers<Input, Imports> {
  return handlers;
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

export function KindOfError<ErrorType extends IError<IType>>(): (
  data: ErrorType['data'],
  messageOrError?: string | Error | undefined | unknown,
) => ErrorType {
  return (data, messageOrError) => {
    let message = '';

    if (typeof messageOrError === 'string') {
      message = messageOrError;
    }

    const error = new Error(message || data.type) as ErrorType;

    if (messageOrError instanceof Error) {
      error.stack = messageOrError.stack;
      error.message = messageOrError.message;
      error.cause = messageOrError.cause;
    }

    error.type = data.type;
    error.data = data;

    return error as ErrorType;
  };
}
