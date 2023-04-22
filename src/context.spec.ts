import { describe, expect, it } from 'vitest';
import { InstallContext, UseContext } from './context';
import { Api } from './library';
import { Context, IContextApi } from './context.type';
import { IHandlers } from './index.type';

describe(UseContext.name, () => {
  it('option / 1 / optimized', async () => {
    type IAppContext = {
      commandId: string;
    };
    type IAppContextApi = IContextApi<IAppContext>;

    const api = Api<IAppContextApi>({
      ...InstallContext<IAppContext>(),
    });

    expect(async () => {
      await api({
        type: Context.GetContext,
      });
    }).rejects.toThrowError('Context not installed, please InstallContext()');
    const initialContext: IAppContext = { commandId: 'command-id-123' };

    const result = await api(
      {
        type: Context.GetContext,
      },
      UseContext(initialContext),
    );

    expect(result).toEqual({ commandId: 'command-id-123' });

    let nextContext: IAppContext | undefined = undefined;
    await api(
      {
        type: Context.MutateContext,
        mutate: (context) => {
          return {
            ...context,
            commandId: 'new-command-id-345',
          };
        },
      },
      UseContext<IAppContext>(initialContext, (context) => {
        nextContext = context;
      }),
    );

    const updatedContext = await api(
      {
        type: Context.GetContext,
      },
      UseContext<IAppContext>(nextContext!),
    );

    expect(updatedContext).toEqual({ commandId: 'new-command-id-345' });
  });

  it('option / 2 / less performant / simple to use', async () => {
    type IAppContext = {
      commandId: string;
    };
    type IAppContextApi = IContextApi<IAppContext>;

    const myAppHandlers: IHandlers<IContextApi<IAppContext>> = {
      // ...my app handlers
      ...InstallContext<IAppContext>(),
    };

    const api = Api<IAppContextApi>({
      ...myAppHandlers,
      ...UseContext<IAppContext>({ commandId: 'command-id-123' }),
    });

    const result = await api({
      type: Context.GetContext,
    });

    expect(result).toEqual({ commandId: 'command-id-123' });

    await api({
      type: Context.MutateContext,
      mutate: (context) => {
        return {
          ...context,
          commandId: 'new-command-id-345',
        };
      },
    });

    const updatedContext = await api({
      type: Context.GetContext,
    });

    expect(updatedContext).toEqual({ commandId: 'new-command-id-345' });
  });
});
