import { ICommand } from 'kinds';
import { describe, expect, it } from 'vitest';

describe('release', () => {
  it('test package.json version', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const installedVersion = require(`${__dirname}/../node_modules/kinds/package.json`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const currentVersion = require(`${__dirname}/../package.json`);

    expect(installedVersion.version).toEqual(currentVersion.version);
  });

  it('smoke test / ICommand', async () => {
    type ICreateUser = ICommand<{ type: 'CreateUser', name: string }>;
    const createUser: ICreateUser = {
      type: 'CreateUser',
      name: 'user name'
    }
  })
});
