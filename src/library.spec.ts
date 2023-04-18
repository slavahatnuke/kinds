import { describe, expect, it, vi } from 'vitest';
import { Feature } from './library';
import { ICommand, IEvent, IModel, IQuery, Kind } from './index';

enum Account {
  Account = 'Account',

  CreateAccount = 'CreateAccount',

  AccountCreated = 'AccountCreated',
  GetAccount = 'GetAccount',
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
});
