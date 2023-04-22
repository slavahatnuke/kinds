import { Feature, KindOfError, Nothing } from './library';
import {
  Context,
  IContextApi,
  IContextMutated,
  IContextMutationError,
  IGetContext,
  IMutateContext,
} from './context.type';
import { IHandlers, IPromise, Kind } from './index.type';

export function InstallContext<T>() {
  const { command, query, error, event, handlers } = Feature<IContextApi<T>>();
  return handlers({
    ...command(Context.MutateContext, async (command, next) => {
      throw new Error(`Context not installed, please ${InstallContext.name}()`);
    }),
    ...query(Context.GetContext, () => {
      throw new Error(`Context not installed, please ${InstallContext.name}()`);
    }),
    ...event(Context.ContextMutated, Nothing),
    ...error(Context.ContextMutationError, Nothing),
  });
}

export const ContextMutationError = KindOfError<IContextMutationError<any>>();

export function UseContext<T>(
  context: T,
  setContext?: (context: T) => IPromise<void>,
): IHandlers<
  IGetContext<T> | IMutateContext<T>,
  IContextMutated<T> | IContextMutationError<T>
> {
  let _context = context;

  return {
    [Context.MutateContext]: {
      type: Context.MutateContext,
      kind: Kind.command,
      handler: async (command, next) => {
        const fromContext = _context;
        try {
          _context = command.mutate(_context);

          if (setContext) {
            await setContext(_context);
          }

          await next({
            type: Context.ContextMutated,
            fromContext,
            toContext: _context,
          });
        } catch (error) {
          const contextMutationError = ContextMutationError(
            {
              type: Context.ContextMutationError,
              fromContext,
            },
            error,
          );

          await next(contextMutationError);

          throw contextMutationError;
        }
      },
    },
    [Context.GetContext]: {
      type: Context.GetContext,
      kind: Kind.query,
      handler: () => _context,
    },
  };
}
