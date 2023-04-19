import { describe, expect, it, vi } from 'vitest';
import { Feature, Never } from './library';
import {
  ICommand,
  IError,
  IEvent,
  IModel,
  INotification,
  IQuery,
  IRejection,
  Kind,
} from './index';

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
type IPostIsCreating = INotification<{
  type: Post.PostIsCreating;
  title: string;
  accountId: string;
}>;

type INoRightsToCreatePost = IRejection<{ type: Post.NoRightsToCreatePost }>;

type IPostApi = ICreatePost | IDeletePost | IGetPost | IGetPosts;
type IPostEvents =
  | IPostCreated
  | IPostDeleted
  | IPostError
  | IPostIsCreating
  | INoRightsToCreatePost;

type IAccountApi = ICreateAccount | IGetAccount;
type IAccountEvents = IAccountCreated;

describe(Feature.name, () => {
  it('api', async () => {
    const x = Feature<ICreateAccount | IGetAccount, IAccountCreated>();
    const y = Feature<IAccountCreated>();

    const xApi = x.Api({
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
    });

    const mockedEventHandler = vi.fn();
    const yHandlers = y.Handlers({
      ...y.event(Account.AccountCreated, mockedEventHandler),
      ...y.event(Account.AccountCreated, mockedEventHandler),
    });

    const result1 = await xApi(
      {
        type: Account.CreateAccount,
        name: 'test',
      },
      y.Api({
        ...yHandlers,
      }),
    );

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    const result2 = await xApi(
      {
        type: Account.GetAccount,
        id: '123',
      },
      y.Api({
        ...yHandlers,
      }),
    );

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
    const x = Feature<ICreateAccount>();

    const xApi = x.Api({
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

    const result1 = await xApi({
      type: Account.CreateAccount,
      name: 'test',
    });

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    await expect(async () => {
      await xApi('foooo' as any);
    }).rejects.toThrow('No handler for "foooo"');
  });

  it('api / custom otherwise', async () => {
    const x = Feature<ICreateAccount>();

    const xApi = x.Api(
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
    const x = Feature<IAccountApi | IPostApi, IAccountEvents | IPostEvents>();
    const y = Feature<IAccountEvents | IPostEvents>();

    const xApi = x.Api({
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
    });

    const mockedEventHandler = vi.fn();
    const yHandlers = y.Handlers({
      ...y.event(Account.AccountCreated, (input, next) => {
        mockedEventHandler(input);
      }),
      ...y.event(Post.PostCreated, (input, next) => {
        mockedEventHandler(input);
      }),
      ...y.event(Post.PostDeleted, (input, next) => {
        mockedEventHandler(input);
      }),
      ...y.error(Post.PostError, (input, next) => {
        mockedEventHandler(input);
      }),
      ...y.notification(Post.PostIsCreating, (input, next) => {
        mockedEventHandler(input);
      }),
      ...y.rejection(Post.NoRightsToCreatePost, (input, next) => {
        mockedEventHandler(input);
      }),
    });

    const result1 = await xApi(
      {
        type: Account.CreateAccount,
        name: 'test',
      },
      x.NextApi(async (input) => {
        return y.Api({
          ...yHandlers,
        })(input);
      }),
    );

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    const result2 = await xApi(
      {
        type: Account.GetAccount,
        id: '123',
      },
      y.Api({
        ...yHandlers,
      }),
    );

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

    const handlers = x.Handlers({
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

    const getKind = x.GetKind(handlers);

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
      case Kind.rejection:
      case Kind.notification:
      case Kind.error:
      case Kind.none:
        expect(kind).toBe(Kind.none);
        break;

      default:
        Never(kind);
    }
  });

  it('app / composition', async () => {
    const app = Feature<IAccountApi | IPostApi, IAccountEvents | IPostEvents>();
    const appBackend = Feature<IAccountEvents | IPostEvents>();

    function AccountApi() {
      const x = Feature<IAccountApi, IAccountEvents>();
      const y = Feature<IAccountEvents>();

      const front = x.Handlers({
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
      });

      const back = y.Handlers({
        ...y.event(Account.AccountCreated, (input, next) => {}),
      });
      return { front, back };
    }

    function PostApi() {
      const x = Feature<IPostApi, IPostEvents>();
      const y = Feature<IPostEvents>();

      const front = x.Handlers({
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
      });

      const back = y.Handlers({
        ...y.event(Post.PostCreated, (input, next) => {}),
        ...y.event(Post.PostDeleted, (input, next) => {}),
        ...y.rejection(Post.NoRightsToCreatePost, (input, next) => {}),
        ...y.error(Post.PostError, (input, next) => {}),
        ...y.notification(Post.PostIsCreating, (input, next) => {}),
      });

      return { front, back };
    }

    const accountApi = AccountApi();
    const postApi = PostApi();

    const xApi = app.Api({
      ...accountApi.front,
      ...postApi.front,
    });

    const yHandlers = appBackend.Handlers({
      ...accountApi.back,
      ...postApi.back,
    });

    const result1 = await xApi(
      {
        type: Account.CreateAccount,
        name: 'test',
      },
      app.NextApi(async (input) => {
        return appBackend.Api({
          ...yHandlers,
        })(input);
      }),
    );

    expect(result1).toEqual({
      id: '1',
      name: 'test',
      type: 'Account',
    });

    const result2 = await xApi(
      {
        type: Account.GetAccount,
        id: '123',
      },
      appBackend.Api({
        ...yHandlers,
      }),
    );

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
