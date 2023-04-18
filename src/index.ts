const _kind = Symbol('_kind');
const _output = Symbol('_output');

export type IType<T extends { type: string } = { type: string }> = T;

export type IUseType<Union extends IType, Type extends Union['type']> = Extract<
  Union,
  { type: Type }
>;

export enum Kind {
  command = 'command',
  query = 'query',
  event = 'event',
  rejection = 'rejection',
  error = 'error',
  notification = 'notification',
  model = 'model',
  none = 'none',
}

export type IKind<T extends Kind = Kind> = { [_kind]?: T };

export type IUseKind<T extends IKind> = T extends IKind
  ? Exclude<T[typeof _kind], undefined>
  : void;

export type IOutput<T = any> = {
  [_output]?: { output: T };
};

export type IUseOutput<T extends IType> = T extends IOutput
  ? Exclude<T[typeof _output], undefined>['output']
  : void;

export type ICommand<T extends IType, Output = void> = T &
  IKind<Kind.command> &
  IOutput<Output>;

export type IQuery<T extends IType, Output = void> = T &
  IKind<Kind.query> &
  IOutput<Output>;

export type IEvent<T extends IType> = T & IKind<Kind.event>;
export type IRejection<T extends IType> = T & IKind<Kind.rejection>;
export type INotification<T extends IType> = T & IKind<Kind.notification>;
export type IModel<T extends IType> = T & IKind<Kind.model>;

export type IError<T extends IType> = Error &
  IType<{ type: T['type']; data: T }> &
  IKind<Kind.error>;

export type IAction<
  Type extends IType = IType,
  Kind extends IKind = IKind,
> = Type & Kind;

export type INone = IType<{ type: Kind.none }> & IKind<Kind.none>;

export type IPromise<T> = T | Promise<T>;

export type IApi<Action extends IAction> = <Input extends Action>(
  input: Input,
) => IPromise<IUseOutput<IUseType<Action, Input['type']>>>;

export type IApiHandler<Input extends IAction, Next extends IAction> = (
  input: Input,
  next: IApi<Next>,
) => IPromise<IUseOutput<Input>>;

export type IHandler<Input extends IAction, Next extends IAction> = {
  kind: IUseKind<Input>;
  type: Input['type'];
  handler: IApiHandler<Input, Next>;
};

export type IHandlers<Input extends IAction, Next extends IAction> = {
  // for commands & queries like
  [ActionType in Input as ActionType['type']]: IHandler<
    IUseType<Input, ActionType['type']>,
    Next
  >;
} & {
  // for events & rejections like
  [EventType in Input as `_${EventType['type']}_${string}`]?: IHandler<
    IUseType<Input, EventType['type']>,
    Next
  >;
};

export type IFeature<Input extends IAction, Next extends IAction = INone> = {
  [K in
    | Kind.command
    | Kind.query
    | Kind.event
    | Kind.rejection
    | Kind.notification
    | Kind.error]: <Type extends Extract<Input, IKind<K>>['type']>(
    input: Type,
    handler: IApiHandler<
      IUseType<Input, Type>,
      Next extends INone ? Input : Next
    >,
  ) => IHandlers<IUseType<Input, Type>, Next extends INone ? Input : Next>;
} & {
  Handlers: (
    handlers: IHandlers<Input, Next extends INone ? Input : Next>,
  ) => IHandlers<Input, Next extends INone ? Input : Next>;
  Api: (
    handlers: IHandlers<Input, Next extends INone ? Input : Next>,
    otherwise?: (input: any, next: IApi<Next>) => IPromise<any>,
  ) => Next extends INone ? IApi<Input> : IApiHandler<Input, Next>;
};
