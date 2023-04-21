const _kind = Symbol('_kind');
const _output = Symbol('_output');
const _input = Symbol('_input');
const _imports = Symbol('_imports');

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

export type IKindMeta<T extends Kind = Kind> = { [_kind]?: T };

export type IInputMeta<T extends IType = IType> = { [_input]?: T };

export type IGetInput<T extends IType> = T extends IInputMeta
  ? Exclude<T[typeof _input], undefined>
  : void;

export type IImportsMeta<T extends IType = IType> = { [_imports]?: T };

export type IGetImports<T extends IType> = T extends IImportsMeta
  ? Exclude<T[typeof _imports], undefined>
  : void;

export type IGetKind<T extends IKindMeta> = T extends IKindMeta
  ? Exclude<T[typeof _kind], undefined>
  : void;

export type IUseKind<Union extends IType, K extends Kind> = Extract<
  Union,
  IKindMeta<K>
>;

export type IOutputMeta<T = any> = {
  [_output]?: { output: T };
};

export type IGetOutput<T extends IType> = T extends IOutputMeta
  ? Exclude<T[typeof _output], undefined>['output']
  : void;

export type ICommand<T extends IType, Output = void> = T &
  IKindMeta<Kind.command> &
  IOutputMeta<Output>;

export type IQuery<T extends IType, Output = void> = T &
  IKindMeta<Kind.query> &
  IOutputMeta<Output>;

export type IEvent<T extends IType> = T & IKindMeta<Kind.event>;
export type IRejection<T extends IType> = T & IKindMeta<Kind.rejection>;
export type INotification<T extends IType> = T & IKindMeta<Kind.notification>;

export type IModel<T extends IType> = T & IKindMeta<Kind.model>;

export type IError<T extends IType> = Error &
  IType<{ type: T['type']; data: T }> &
  IKindMeta<Kind.error>;

export type IActionKind =
  | Kind.command
  | Kind.query
  | Kind.event
  | Kind.rejection
  | Kind.notification
  | Kind.error;

export type IAction<
  Type extends IType = IType,
  Kind extends IKindMeta<IActionKind> = IKindMeta<IActionKind>,
> = Type & Kind;

export type INone = IType<{ type: Kind.none }> & IKindMeta<Kind.none>;

export type IPromise<T> = T | Promise<T>;

export type IApi<Action extends IAction | INone> = <Input extends Action>(
  input: Input,
) => IPromise<IGetOutput<IUseType<Action, Input['type']>>>;

export type IActionHandler<
  Input extends IAction,
  Next extends IAction | INone,
> = (
  input: Input,
  next: IApi<Exclude<Next, INone>>,
) => IPromise<IGetOutput<Input>>;

export type IHandler<Input extends IAction, Imports extends IAction | INone> = {
  kind: IGetKind<Input>;
  type: Input['type'];
  handler: IActionHandler<Input, Imports>;
} & IInputMeta<Input> &
  IImportsMeta<Input | Imports>;

export type IHandlers<
  Input extends IAction,
  Imports extends IAction | INone = INone,
> = {
  // for commands & queries like
  [ActionType in Input as ActionType['type']]: IHandler<
    IUseType<Input, ActionType['type']>,
    Input | Imports
  >;
} & {
  // for events & rejections like
  [EventType in Input as `_${EventType['type']}_${string}`]?: IHandler<
    IUseType<Input, EventType['type']>,
    Input | Imports
  >;
};

export type IMakeApi<
  Input extends IAction,
  Imports extends IAction | INone = INone,
> = (handlers: IHandlers<Input, Imports>) => IApi<Input>;

export type IGetActionKind<Handlers extends IHandlers<IAction>> = (
  handlers: Handlers,
) => (input: any) => IActionKind | Kind.none;

export type IFeature<
  Input extends IAction,
  Imports extends IAction | INone = INone,
> = {
  [K in IActionKind]: <Type extends IUseKind<Input, K>['type']>(
    input: Type,
    handler: IActionHandler<IUseType<Input, Type>, Input | Imports>,
  ) => IHandlers<IUseType<Input, Type>, Input | Imports>;
} & {
  handlers: (handlers: IHandlers<Input, Imports>) => IHandlers<Input, Imports>;
};
