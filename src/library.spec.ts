import { describe, expect, it, vi } from 'vitest';
import { Api, Feature, GetKind, Never } from './library';
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
      ...when.notification(Post.PostIsCreating, (input, next) => {
        mockedEventHandler(input);
      }),
      ...when.rejection(Post.NoRightsToCreatePost, (input, next) => {
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

    const getKind = GetKind(handlers as any);

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
        ...x.rejection(Post.NoRightsToCreatePost, (input, next) => {}),
        ...x.error(Post.PostError, (input, next) => {}),
        ...x.notification(Post.PostIsCreating, (input, next) => {}),
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
