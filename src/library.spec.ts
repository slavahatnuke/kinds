import { describe, expect, it, vi } from 'vitest';
import {
  Api,
  Feature,
  GetKind,
  Handlers,
  HasHandler,
  KindOfError,
  Never,
  Nothing,
} from './library';
import { ICommand, IError, IEvent, IModel, IQuery, Kind } from './index.type';

enum Account {
  Account = 'Account',

  CreateAccount = 'Account.CreateAccount',

  AccountCreated = 'Account.AccountCreated',
  GetAccount = 'Account.GetAccount',
}

type IAccount = IModel<{ type: Account.Account; id: string; name: string }>;
type ICreateAccount = ICommand<
  { type: Account.CreateAccount; name: string },
  IAccount
>;
type IAccountCreated = IEvent<{
  type: Account.AccountCreated;
  account: IAccount;
}>;
type IGetAccount = IQuery<
  { type: Account.GetAccount; id: string },
  IAccount | null
>;

enum Post {
  Post = 'Post',
  PostRef = 'PostRef',

  CreatePost = 'Post.CreatePost',
  DeletePost = 'Post.DeletePost',
  GetPost = 'Post.GetPost',
  GetPosts = 'Post.GetPosts',

  PostCreated = 'Post.PostCreated',
  PostDeleted = 'Post.PostDeleted',

  PostIsCreating = 'Post.PostIsCreating',
  NoRightsToCreatePost = 'Post.NoRightsToCreatePost',

  PostError = 'Post.PostError',
}

type IPost = IModel<{
  type: Post.Post;
  id: string;
  title: string;
  accountId: string;
}>;

type IPostRef = IModel<{ type: Post.PostRef; id: string; accountId: string }>;

type ICreatePost = ICommand<{ type: Post.CreatePost; title: string }, IPost>;
type IPostCreated = IEvent<{ type: Post.PostCreated; post: IPost }>;

type IDeletePost = ICommand<{ type: Post.DeletePost; id: string }, IPost['id']>;
type IPostDeleted = IEvent<{ type: Post.PostDeleted; id: IPost['id'] }>;

type IGetPost = IQuery<{ type: Post.GetPost; id: string }, IPost | null>;
type IGetPosts = IQuery<{ type: Post.GetPosts }, IPost[]>;

type IPostError = IError<{ type: Post.PostError; postRef: IPostRef }>;

type IPostApi = ICreatePost | IDeletePost | IGetPost | IGetPosts;
type IPostEvents = IPostCreated | IPostDeleted | IPostError;

type IAccountApi = ICreateAccount | IGetAccount;
type IAccountEvents = IAccountCreated;

describe(Api.name, () => {
  it('api', async () => {
    const { command, event, handlers } = Feature<
      ICreateAccount | IAccountCreated
    >();

    const api = Api(
      handlers({
        ...command(Account.CreateAccount, async (command, next) => {
          const account: IAccount = {
            type: Account.Account,
            id: '1',
            name: command.name,
          };

          await next({
            type: Account.AccountCreated,
            account,
          });

          return account;
        }),
        ...event(Account.AccountCreated, Nothing),
      }),
    );

    const account = await api({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(account).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });
  });
  it('api / listener', async () => {
    const { command, event, handlers } = Feature<
      ICreateAccount | IAccountCreated
    >();

    const messages: any[] = [];
    const listener = async (message: any) => {
      messages.push(message);
    };
    const api = Api(
      handlers({
        ...command(Account.CreateAccount, async (command, next) => {
          const account: IAccount = {
            type: Account.Account,
            id: '1',
            name: command.name,
          };

          await next({
            type: Account.AccountCreated,
            account,
          });

          return account;
        }),
        ...event(Account.AccountCreated, Nothing),
      }),
      listener,
    );

    const account = await api({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(account).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    expect(messages).toEqual([
      {
        type: Account.CreateAccount,
        name: 'test',
      },
      {
        type: Account.AccountCreated,
        account: account,
      },
    ]);
  });

  it('api / overrides', async () => {
    const { command, event, error, handlers } = Feature<
      ICreateAccount | IAccountCreated
    >();

    const messages: any[] = [];

    const api = Api(
      handlers({
        ...command(Account.CreateAccount, async (command, next) => {
          const account: IAccount = {
            type: Account.Account,
            id: '1',
            name: command.name,
          };

          await next({
            type: Account.AccountCreated,
            account,
          });

          return account;
        }),
        ...event(Account.AccountCreated, Nothing),
      }),
      async (message) => {
        messages.push(message);
      },
    );

    const account1 = await api({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(account1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    expect(messages).toEqual([
      {
        name: 'test',
        type: Account.CreateAccount,
      },
      {
        account: account1,
        type: Account.AccountCreated,
      },
    ]);

    const featureOverrides = Feature<ICreateAccount, IAccountCreated>();

    const overrides = featureOverrides.handlers({
      ...featureOverrides.command(
        Account.CreateAccount,
        async (command, next) => {
          const account: IAccount = {
            type: Account.Account,
            id: '2',
            name: command.name,
          };

          await next({
            type: Account.AccountCreated,
            account: {
              ...account,
              name: 'overriden',
            },
          });

          return account;
        },
      ),
    });

    const account2 = await api(
      {
        type: Account.CreateAccount,
        name: 'test#2',
      },
      overrides,
    );

    expect(account2).toEqual({
      type: Account.Account,
      id: '2',
      name: 'test#2',
    });

    expect(messages).toEqual([
      {
        name: 'test',
        type: Account.CreateAccount,
      },
      {
        account: account1,
        type: Account.AccountCreated,
      },
      {
        name: 'test#2',
        type: Account.CreateAccount,
      },
      {
        account: {
          id: '2',
          name: 'overriden',
          type: 'Account',
        },
        type: Account.AccountCreated,
      },
    ]);
  });
});

describe(Feature.name, () => {
  it('feature and api', async () => {
    const { event } = Feature<ICreateAccount | IGetAccount | IAccountCreated>();

    const mockedEventHandler = vi.fn();

    const api = Api<ICreateAccount | IGetAccount | IAccountCreated>({
      [Account.CreateAccount]: {
        type: Account.CreateAccount,
        kind: Kind.command,
        handler: async (command, next) => {
          const account: IAccount = {
            type: Account.Account,
            id: '1',
            name: command.name,
          };

          await next({
            type: Account.AccountCreated,
            account,
          });

          return account;
        },
      },
      [Account.GetAccount]: {
        type: Account.GetAccount,
        kind: Kind.query,
        handler: async (query) => {
          return {
            type: Account.Account,
            id: query.id,
            name: `Name ${query.id}`,
          };
        },
      },
      ...event(Account.AccountCreated, mockedEventHandler),
      ...event(Account.AccountCreated, mockedEventHandler),
    });

    const result1 = await api({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    const result2 = await api({
      type: Account.GetAccount,
      id: '123',
    });

    expect(result2).toEqual({
      id: '123',
      name: 'Name 123',
      type: 'Account',
    });
    expect(mockedEventHandler).toHaveBeenCalledTimes(2);
    expect(mockedEventHandler).toHaveBeenCalledWith(
      {
        type: Account.AccountCreated,
        account: {
          id: '1',
          name: 'test',
          type: 'Account',
        },
      },
      expect.anything(),
    );
  });

  it('api / default otherwise', async () => {
    const api = Api<ICreateAccount>({
      [Account.CreateAccount]: {
        type: Account.CreateAccount,
        kind: Kind.command,
        handler: async (command, next) => {
          const account: IAccount = {
            type: Account.Account,
            id: '1',
            name: command.name,
          };

          return account;
        },
      },
    });

    const result1 = await api({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    await expect(async () => {
      await api('foooo' as any);
    }).rejects.toThrow('NO_HANDLER: "foooo"');
  });

  it('api / custom otherwise', async () => {
    const xApi = Api<ICreateAccount>(
      {
        [Account.CreateAccount]: {
          type: Account.CreateAccount,
          kind: Kind.command,
          handler: async (command, next) => {
            const account: IAccount = {
              type: Account.Account,
              id: '1',
              name: command.name,
            };

            return account;
          },
        },
      },
      undefined,
      (input) => {
        return null;
      },
    );

    const result1 = await xApi({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    expect(await xApi('foooo' as any)).toBe(null);
  });

  it('app / very flat api', async () => {
    const when = Feature<
      IAccountApi | IPostApi | IAccountEvents | IPostEvents
    >();

    const mockedEventHandler = vi.fn();

    const api = Api<IAccountApi | IPostApi | IAccountEvents | IPostEvents>({
      ...when.command(Account.CreateAccount, async (command, next) => {
        const account: IAccount = {
          type: Account.Account,
          id: '1',
          name: command.name,
        };

        await next({
          type: Account.AccountCreated,
          account,
        });

        return account;
      }),
      ...when.query(Account.GetAccount, async (query) => {
        return {
          type: Account.Account,
          id: query.id,
          name: `Name ${query.id}`,
        };
      }),
      ...when.command(Post.CreatePost, async (command, next) => {
        const post: IPost = {
          type: Post.Post,
          id: '1',
          title: command.title,
          accountId: '1',
        };

        await next({
          type: Post.PostCreated,
          post,
        });

        return post;
      }),
      ...when.query(Post.GetPost, async (query) => {
        return {
          type: Post.Post,
          id: query.id,
          title: `Title ${query.id}`,
          accountId: '1',
        };
      }),
      ...when.query(Post.GetPosts, async (query) => {
        return [];
      }),
      ...when.command(Post.DeletePost, async (command, next) => {
        await next({
          type: Post.PostDeleted,
          id: command.id,
        });

        return command.id;
      }),
      ...when.event(Account.AccountCreated, (input, next) => {
        mockedEventHandler(input);
      }),
      ...when.event(Post.PostCreated, (input, next) => {
        mockedEventHandler(input);
      }),
      ...when.event(Post.PostDeleted, (input, next) => {
        mockedEventHandler(input);
      }),
      ...when.error(Post.PostError, (input, next) => {
        mockedEventHandler(input);
      }),
    });

    const result1 = await api({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    const result2 = await api({
      type: Account.GetAccount,
      id: '123',
    });

    expect(result2).toEqual({
      id: '123',
      name: 'Name 123',
      type: 'Account',
    });

    expect(mockedEventHandler.mock.calls).toEqual([
      [
        {
          account: {
            id: '1',
            name: 'test',
            type: Account.Account,
          },
          type: Account.AccountCreated,
        },
      ],
    ]);
  });

  it('get kind', () => {
    const x = Feature<ICreateAccount | IGetAccount>();

    const handlers = x.handlers({
      ...x.command(Account.CreateAccount, async (command, next) => {
        const account: IAccount = {
          type: Account.Account,
          id: '1',
          name: command.name,
        };

        return account;
      }),
      ...x.query(Account.GetAccount, async (query) => {
        return {
          type: Account.Account,
          id: query.id,
          name: `Name ${query.id}`,
        };
      }),
    });

    const getKind = GetKind(handlers);

    expect(
      getKind({
        type: Account.CreateAccount,
        name: 'test',
      }),
    ).toBe(Kind.command);

    expect(
      getKind({
        type: Account.GetAccount,
        name: 'test',
      }),
    ).toBe(Kind.query);

    expect(getKind('fooo')).toBe(Kind.none);

    const kind = getKind('fooo');
    switch (kind) {
      case Kind.command:
      case Kind.query:
      case Kind.event:
      case Kind.error:
      case Kind.none:
        expect(kind).toBe(Kind.none);
        break;

      default:
        Never(kind);
    }
  });

  it('app / composition', async () => {
    const app = Feature<
      IAccountApi | IPostApi | IAccountEvents | IPostEvents
    >();

    function AccountApi() {
      const x = Feature<IAccountApi | IAccountEvents>();

      const handlers = x.handlers({
        ...x.command(Account.CreateAccount, async (command, next) => {
          const account: IAccount = {
            type: Account.Account,
            id: '1',
            name: command.name,
          };

          await next({
            type: Account.AccountCreated,
            account,
          });

          return account;
        }),
        ...x.query(Account.GetAccount, async (query) => {
          return {
            type: Account.Account,
            id: query.id,
            name: `Name ${query.id}`,
          };
        }),
        ...x.event(Account.AccountCreated, (input, next) => {}),
      });

      return handlers;
    }

    function PostApi() {
      const x = Feature<IPostApi | IPostEvents>();

      const handlers = x.handlers({
        ...x.command(Post.CreatePost, async (command, next) => {
          const post: IPost = {
            type: Post.Post,
            id: '1',
            title: command.title,
            accountId: '1',
          };

          await next({
            type: Post.PostCreated,
            post,
          });

          return post;
        }),
        ...x.query(Post.GetPost, async (query) => {
          return {
            type: Post.Post,
            id: query.id,
            title: `Title ${query.id}`,
            accountId: '1',
          };
        }),
        ...x.query(Post.GetPosts, async (query) => {
          return [];
        }),
        ...x.command(Post.DeletePost, async (command, next) => {
          await next({
            type: Post.PostDeleted,
            id: command.id,
          });
          return command.id;
        }),
        ...x.event(Post.PostCreated, (input, next) => {}),
        ...x.event(Post.PostDeleted, (input, next) => {}),
        ...x.error(Post.PostError, (input, next) => {}),
      });

      return handlers;
    }

    const accountApi = AccountApi();
    const postApi = PostApi();

    const xApi = Api<IAccountApi | IPostApi | IAccountEvents | IPostEvents>({
      ...accountApi,
      ...postApi,
    });

    const result1 = await xApi({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    const result2 = await xApi({
      type: Account.GetAccount,
      id: '123',
    });

    expect(result2).toEqual({
      id: '123',
      name: 'Name 123',
      type: 'Account',
    });
  });
});

describe(Never.name, () => {
  it('never', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      Never('foo');
    }).toThrow(`Never: "foo"`);
  });
});

describe(KindOfError.name, () => {
  it('NewError', () => {
    const PostError = KindOfError<IPostError>();

    const postError = PostError({
      type: Post.PostError,
      postRef: {
        type: Post.PostRef,
        id: '1',
        accountId: 'accountId',
      },
    });

    expect(postError).instanceOf(Error);
    expect(postError.type).toEqual(Post.PostError);
    expect(postError.data).toEqual({
      type: Post.PostError,
      postRef: {
        type: Post.PostRef,
        id: '1',
        accountId: 'accountId',
      },
    });
    expect(postError.message).toContain('Post.PostError');
  });
  it('NewError / Inherited', () => {
    const error = new Error('foo');
    const PostError = KindOfError<IPostError>();

    const postError = PostError(
      {
        type: Post.PostError,
        postRef: {
          type: Post.PostRef,
          id: '1',
          accountId: 'accountId',
        },
      },
      error,
    );

    expect(postError).instanceOf(Error);
    expect(postError.type).toEqual(Post.PostError);
    expect(postError.data).toEqual({
      type: Post.PostError,
      postRef: {
        type: Post.PostRef,
        id: '1',
        accountId: 'accountId',
      },
    });
    expect(postError.message).toEqual('foo');
    expect(postError.stack).toEqual(error.stack);
  });
});

describe(HasHandler.name, () => {
  it('test', () => {
    const on = Feature<ICreateAccount | IGetAccount>();
    const handlers = Handlers<ICreateAccount | IGetAccount>({
      ...on.command(Account.CreateAccount, async (command, next) => {
        const account: IAccount = {
          type: Account.Account,
          id: '1',
          name: command.name,
        };

        return account;
      }),
      ...on.query(Account.GetAccount, async (query) => {
        return {
          type: Account.Account,
          id: query.id,
          name: `Name ${query.id}`,
        };
      }),
    });
    const hasHandler = HasHandler(handlers);

    expect(hasHandler(null)).toBe(false);
    expect(hasHandler(undefined)).toBe(false);
    expect(
      hasHandler({
        type: 'fooo',
      }),
    ).toBe(false);

    expect(
      hasHandler({
        type: Account.CreateAccount,
      }),
    ).toBe(true);

    expect(
      hasHandler({
        type: Account.CreateAccount,
        name: 'test',
      } satisfies ICreateAccount),
    ).toBe(true);
  });
});
