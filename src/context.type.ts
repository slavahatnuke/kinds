import { ICommand, IError, IEvent, IQuery } from './index.type';

export enum Context {
  GetContext = 'Context.GetContext',
  MutateContext = 'Context.MutateContext',
  ContextMutated = 'Context.ContextMutated',
  ContextMutationError = 'Context.ContextMutationError',
}

export type IMutateContext<T> = ICommand<{
  type: Context.MutateContext;
  mutate: (context: T) => T;
}>;

export type IGetContext<T> = IQuery<{ type: Context.GetContext }, T>;

export type IContextMutated<T> = IEvent<{
  type: Context.ContextMutated;
  fromContext: T;
  toContext: T;
}>;

export type IContextMutationError<T> = IError<{
  type: Context.ContextMutationError;
  fromContext: T;
}>;

export type IContextApi<Context> =
  | IGetContext<Context>
  | IMutateContext<Context>
  | IContextMutated<Context>
  | IContextMutationError<Context>;
