import {Filename, ppath, xfs, npath, PortablePath}   from '@yarnpkg/fslib';
import os                                            from 'node:os';
import process                                       from 'node:process';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import config                                        from '../config.json';
import * as folderUtils                              from '../sources/folderUtils';
import {SupportedPackageManagerSet}                  from '../sources/types';

import {runCli}                                      from './_runCli';


beforeEach(async () => {
  const home = await xfs.mktempPromise();

  // `process.env` is reset after each tests in setupTests.js.
  process.env.COREPACK_HOME = npath.fromPortablePath(home);
  process.env.COREPACK_DEFAULT_TO_LATEST = `0`;

  return async () => {
    await xfs.removePromise(home, {recursive: true});
  };
});

describe(`should refuse to download a package manager if the hash doesn't match`, () => {
  it(`the one defined in "devEngines.packageManager" field`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        devEngines: {
          packageManager: {name: `yarn`, version: `1.22.4+sha1.deadbeef`},
        },
      });

      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Mismatch hashes`),
        stdout: ``,
      });
    });
  });
  it(`the one defined in "packageManager" field`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        packageManager: `yarn@1.22.4+sha1.deadbeef`,
      });

      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Mismatch hashes`),
        stdout: ``,
      });
    });
  });
});

it(`should refuse to download a known package manager from a URL`, async () => {
  await xfs.mktempPromise(async cwd => {
    // Package managers known by Corepack cannot be loaded from a URL.
    await expect(runCli(cwd, [`yarn@https://registry.npmjs.com/yarn/-/yarn-1.22.21.tgz`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining(`Illegal use of URL for known package manager`),
      stdout: ``,
    });

    // Unknown package managers can be loaded from a URL.
    await expect(runCli(cwd, [`corepack@https://registry.npmjs.com/corepack/-/corepack-0.24.1.tgz`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `0.24.1\n`,
    });
  });
});

it.fails(`should refuse to download a known package manager from a URL in package.json`, async () => {
  await xfs.mktempPromise(async cwd => {
    // Package managers known by Corepack cannot be loaded from a URL.
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@https://registry.npmjs.com/yarn/-/yarn-1.22.21.tgz`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining(`Illegal use of URL for known package manager`),
      stdout: ``,
    });

    // Unknown package managers can be loaded from a URL.
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `corepack@https://registry.npmjs.com/corepack/-/corepack-0.24.1.tgz`,
    });

    await expect(runCli(cwd, [`corepack`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `0.24.1\n`,
    });
  });
});

it(`should require a version to be specified`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stderr: `No version specified for yarn in "packageManager" of package.json\n`,
      stdout: ``,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@stable`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining(`expected a semver version`),
      stdout: ``,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@^1.0.0`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining(`expected a semver version`),
      stdout: ``,
    });
  });
});

const testedPackageManagers: Array<[string, string] | [string, string, string]> = [
  [`yarn`, `1.22.4`],
  [`yarn`, `1.22.4+sha1.01c1197ca5b27f21edc8bc472cd4c8ce0e5a470e`],
  [`yarn`, `1.22.4+sha224.0d6eecaf4d82ec12566fdd97143794d0f0c317e0d652bd4d1b305430`],
  [`yarn`, `https://registry.npmjs.com/yarn/-/yarn-1.22.21.tgz`, `1.22.21`],
  [`yarn`, `https://registry.npmjs.com/yarn/-/yarn-1.22.21.tgz#sha1.1959a18351b811cdeedbd484a8f86c3cc3bbaf72`, `1.22.21`],
  [`yarn`, `2.0.0-rc.30`],
  [`yarn`, `2.0.0-rc.30+sha1.4f0423b01bcb57f8e390b4e0f1990831f92dd1da`],
  [`yarn`, `2.0.0-rc.30+sha224.0e7a64468c358596db21c401ffeb11b6534fce7367afd3ae640eadf1`],
  [`yarn`, `3.0.0-rc.2`],
  [`yarn`, `3.0.0-rc.2+sha1.694bdad81703169e203febd57f9dc97d3be867bd`],
  [`yarn`, `3.0.0-rc.2+sha224.f83f6d1cbfac10ba6b516a62ccd2a72ccd857aa6c514d1cd7185ec60`],
  [`pnpm`, `4.11.6`],
  [`pnpm`, `4.11.6+sha1.7cffc04295f4db4740225c6c37cc345eb923c06a`],
  [`pnpm`, `4.11.6+sha224.7783c4b01916b7a69e6ff05d328df6f83cb7f127e9c96be88739386d`],
  [`pnpm`, `6.6.2`],
  [`pnpm`, `6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`],
  [`pnpm`, `6.6.2+sha224.eb5c0acad3b0f40ecdaa2db9aa5a73134ad256e17e22d1419a2ab073`],
  [`npm`, `6.14.2`],
  [`npm`, `6.14.2+sha1.f057d35cd4792c4c511bb1fa332edb43143d07b0`],
  [`npm`, `6.14.2+sha224.50512c1eb404900ee78586faa6d756b8d867ff46a328e6fb4cdf3a87`],
];

for (const [name, version, expectedVersion = version.split(`+`, 1)[0]] of testedPackageManagers) {
  it(`should use the right package manager version for a given project (${name}@${version})`, async () => {
    process.env.COREPACK_ENABLE_UNSAFE_CUSTOM_URLS = `1`;
    await xfs.mktempPromise(async cwd => {
      await expect(runCli(cwd, [`${name}@${version}`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: ``,
        stdout: `${expectedVersion}\n`,
      });

      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        packageManager: `${name}@${version}`,
      });

      await expect(runCli(cwd, [name, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: ``,
        stdout: `${expectedVersion}\n`,
      });

      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        devEngines: {packageManager: {name, version}},
      });

      await expect(runCli(cwd, [name, `--version`])).resolves.toMatchObject(URL.canParse(version) ? {
        exitCode: 1,
        stderr: expect.stringMatching(/^The value of devEngines\.packageManager\.version ".+" is not a valid semver range\n$/),
        stdout: ``,
      } : {
        exitCode: 0,
        stderr: ``,
        stdout: `${expectedVersion}\n`,
      });
    });
  });
}

it(`should update the Known Good Release only when the major matches`, async () => {
  await xfs.writeJsonPromise(ppath.join(npath.toPortablePath(folderUtils.getCorepackHomeFolder()), `lastKnownGood.json`), {
    yarn: `1.0.0`,
  });

  process.env.COREPACK_DEFAULT_TO_LATEST = `1`;

  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@1.22.4+sha224.0d6eecaf4d82ec12566fdd97143794d0f0c317e0d652bd4d1b305430`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `1.22.4\n`,
    });

    await xfs.removePromise(ppath.join(cwd, `package.json` as Filename));

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `1.22.4\n`,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `2.2.2\n`,
    });

    await xfs.removePromise(ppath.join(cwd, `package.json` as Filename));

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `1.22.4\n`,
    });
  });
});

it(`should ignore the packageManager field when found within a node_modules vendor`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.mkdirPromise(ppath.join(cwd, `node_modules/foo` as PortablePath), {recursive: true});
    await xfs.mkdirPromise(ppath.join(cwd, `node_modules/@foo/bar` as PortablePath), {recursive: true});

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
      packageManager: `yarn@1.22.4`,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `node_modules/foo/package.json` as PortablePath), {
      packageManager: `npm@6.14.2`,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `node_modules/@foo/bar/package.json` as PortablePath), {
      packageManager: `npm@6.14.2`,
    });

    await expect(runCli(ppath.join(cwd, `node_modules/foo` as PortablePath), [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `1.22.4\n`,
    });

    await expect(runCli(ppath.join(cwd, `node_modules/@foo/bar` as PortablePath), [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `1.22.4\n`,
    });
  });
});

describe(`should handle invalid devEngines values`, () => {
  it(`throw on missing version`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `yarn`,
          },
        },
      });

      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: `Invalid package manager specification in package.json (yarn@*); expected a semver version\n`,
        stdout: ``,
      });
    });
  });
  it(`throw on invalid version`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `yarn`,
            version: `yarn@1.x`,
          },
        },
      });

      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: `The value of devEngines.packageManager.version "yarn@1.x" is not a valid semver range\n`,
        stdout: ``,
      });
    });
  });
  it(`warn on array values`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        packageManager: `yarn@1.22.4+sha1.01c1197ca5b27f21edc8bc472cd4c8ce0e5a470e`,
        devEngines: {
          packageManager: [{
            name: `pnpm`,
            version: `10.x`,
          },
          ]},
      });

      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: `! Corepack does not currently support array values for devEngines.packageManager\n`,
        stdout: `1.22.4\n`,
      });
    });
  });
  it(`warn on string values`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        packageManager: `yarn@1.22.4+sha1.01c1197ca5b27f21edc8bc472cd4c8ce0e5a470e`,
        devEngines: {
          packageManager: `pnpm@10.x`,
        },
      });

      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: `! Corepack only supports objects as valid value for devEngines.packageManager. The current value ("pnpm@10.x") will be ignored.\n`,
        stdout: `1.22.4\n`,
      });
    });
  });
  it(`warn on number values`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        packageManager: `yarn@1.22.4+sha1.01c1197ca5b27f21edc8bc472cd4c8ce0e5a470e`,
        devEngines: {
          packageManager: 10,
        },
      });

      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: `! Corepack only supports objects as valid value for devEngines.packageManager. The current value (10) will be ignored.\n`,
        stdout: `1.22.4\n`,
      });
    });
  });
});

it(`should use hash from "packageManager" even when "devEngines" defines a different one`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
      packageManager: `yarn@3.0.0-rc.2+sha1.11111`,
      devEngines: {
        packageManager: {
          name: `yarn`,
          version: `3.0.0-rc.2+sha1.22222`,
        },
      },
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining(`Mismatch hashes. Expected 11111, got`),
      stdout: ``,
    });
  });
});

describe(`should accept range in devEngines only if a specific version is provided`, () => {
  it(`either in package.json#packageManager field`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `pnpm`,
            version: `6.x`,
          },
        },
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: `Invalid package manager specification in package.json (pnpm@6.x); expected a semver version\n`,
        stdout: ``,
      });

      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `pnpm`,
            version: `6.x`,
          },
        },
        packageManager: `pnpm@6.6.2+sha224.eb5c0acad3b0f40ecdaa2db9aa5a73134ad256e17e22d1419a2ab073`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: ``,
        stdout: `6.6.2\n`,
      });

      // No version should also work
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `pnpm`,
          },
        },
        packageManager: `pnpm@6.6.2+sha224.eb5c0acad3b0f40ecdaa2db9aa5a73134ad256e17e22d1419a2ab073`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: ``,
        stdout: `6.6.2\n`,
      });
    });
  });
});

describe(`when devEngines.packageManager.name does not match packageManager`, () => {
  it(`should ignore if devEngines.packageManager.onFail is set to "ignore"`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `yarn`,
            onFail: `ignore`,
          },
        },
        packageManager: `pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: ``,
        stdout: `6.6.2\n`,
      });
    });
  });
  it(`should warn if devEngines.packageManager.onFail is set to "warn"`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `yarn`,
            onFail: `warn`,
          },
        },
        packageManager: `pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: `! Corepack validation warning: "packageManager" field is set to "pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854" which does not match the "devEngines.packageManager" field set to "yarn"\n`,
        stdout: `6.6.2\n`,
      });
    });
  });
  it(`should throw if devEngines.packageManager.onFail is set to "error"`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `yarn`,
            onFail: `error`,
          },
        },
        packageManager: `pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: `"packageManager" field is set to "pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854" which does not match the "devEngines.packageManager" field set to "yarn"\n`,
        stdout: ``,
      });
    });
  });
  it(`should throw by default`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `yarn`,
          },
        },
        packageManager: `pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: `"packageManager" field is set to "pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854" which does not match the "devEngines.packageManager" field set to "yarn"\n`,
        stdout: ``,
      });
    });
  });
});

describe(`should reject if range in devEngines does not match version provided`,  () => {
  it(`unless onFail is set to "ignore"`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `pnpm`,
            version: `10.x`,
            onFail: `ignore`,
          },
        },
        packageManager: `pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: ``,
        stdout: `6.6.2\n`,
      });
    });
  });
  it(`unless onFail is set to "warn"`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `pnpm`,
            version: `10.x`,
            onFail: `warn`,
          },
        },
        packageManager: `pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stderr: `! Corepack validation warning: "packageManager" field is set to "pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854" which does not match the value defined in "devEngines.packageManager" for "pnpm" of "10.x"\n`,
        stdout: `6.6.2\n`,
      });
    });
  });
  it(`in package.json#packageManager field`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
        devEngines: {
          packageManager: {
            name: `pnpm`,
            version: `10.x`,
          },
        },
        packageManager: `pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854`,
      });
      await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
        exitCode: 1,
        stderr: `"packageManager" field is set to "pnpm@6.6.2+sha1.7b4d6b176c1b93b5670ed94c24babb7d80c13854" which does not match the value defined in "devEngines.packageManager" for "pnpm" of "10.x"\n`,
        stdout: ``,
      });
    });
  });
});

it(`should use the closest matching packageManager field`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.mkdirPromise(ppath.join(cwd, `foo` as PortablePath), {recursive: true});

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as PortablePath), {
      packageManager: `yarn@1.22.4`,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `foo/package.json` as PortablePath), {
      packageManager: `npm@6.14.2`,
    });

    await expect(runCli(ppath.join(cwd, `foo` as PortablePath), [`npm`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
      stdout: `6.14.2\n`,
    });
  });
});

it(`should expose its root to spawned processes`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `npm@6.14.2`,
    });

    await expect(runCli(cwd, [`npm`, `run`, `env`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringContaining(`COREPACK_ROOT=${npath.dirname(__dirname)}`),
    });
  });
});

it(`shouldn't allow using regular Yarn commands on npm-configured projects`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `npm@6.14.2`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stderr: expect.stringContaining(`This project is configured to use npm`),
    });
  });
});

it(`should allow using transparent commands on npm-configured projects`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `npm@6.14.2`,
    });

    await expect(runCli(cwd, [`yarn`, `dlx`, `--help`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });
  });
});

it(`should transparently use the preconfigured version when there is no local project`, async () => {
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });
  });
});

// Note that we don't prevent using any package manager. This ensures that
// projects will receive as little disruption as possible (for example, we
// don't prompt to set the packageManager field).

for (const name of SupportedPackageManagerSet) {
  it(`should use the pinned version when local projects don't list any spec (${name})`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        // empty package.json file
      });

      await expect(runCli(cwd, [name, `--version`])).resolves.toMatchObject({
        stdout: `${config.definitions[name].default.split(`+`, 1)[0]}\n`,
        exitCode: 0,
      });
    });
  });
}

describe(`when called on a project without any defined packageManager`, () => {
  it(`should not modify package.json by default`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      // empty package.json file
      });

      await runCli(cwd, [`yarn`]);

      const data = await xfs.readJsonPromise(ppath.join(cwd, `package.json` as Filename));

      expect(Object.hasOwn(data, `packageManager`)).toBeFalsy();
    });
  });

  it(`should modify package.json if enabled by env`, async () => {
    process.env.COREPACK_ENABLE_AUTO_PIN = `1`;

    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      // empty package.json file
      });

      await runCli(cwd, [`yarn`]);

      const data = await xfs.readJsonPromise(ppath.join(cwd, `package.json` as Filename));

      expect(data).toMatchObject({
        packageManager: expect.stringMatching(/^yarn@/),
      });
    });
  });

  it(`should modify package.json if enabled by .corepack.env`, async t => {
    // Skip that test on Node.js 18.x as it lacks support for .env files.
    if (process.version.startsWith(`v18.`)) t.skip();

    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        // empty package.json file
      });
      await xfs.writeFilePromise(ppath.join(cwd, `.corepack.env` as Filename), `COREPACK_ENABLE_AUTO_PIN=1\n`);

      await runCli(cwd, [`yarn`]);

      const data = await xfs.readJsonPromise(ppath.join(cwd, `package.json` as Filename));

      expect(data).toMatchObject({
        packageManager: expect.stringMatching(/^yarn@/),
      });
    });
  });

  it(`should not modify package.json if .corepack.env is disabled`, async () => {
    process.env.COREPACK_ENV_FILE = `0`;

    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        // empty package.json file
      });
      await xfs.writeFilePromise(ppath.join(cwd, `.corepack.env` as Filename), `COREPACK_ENABLE_AUTO_PIN=1\n`);

      await runCli(cwd, [`yarn`]);

      const data = await xfs.readJsonPromise(ppath.join(cwd, `package.json` as Filename));

      expect(Object.hasOwn(data, `packageManager`)).toBeFalsy();
    });
  });
});

it(`should allow updating the pinned version using the "corepack install -g" command`, async () => {
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`install`, `-g`, `yarn@1.0.0`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      // empty package.json file
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `1.0.0\n`,
      exitCode: 0,
    });
  });
});

it(`should allow to call "corepack install -g" with a tag`, async () => {
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`install`, `-g`, `npm@latest-7`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      // empty package.json file
    });

    await expect(runCli(cwd, [`npm`, `--version`])).resolves.toMatchObject({
      stdout: expect.stringMatching(/^7\./),
      exitCode: 0,
    });
  });
});

it(`should allow to call "corepack install -g" without any range`, async () => {
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`install`, `-g`, `yarn`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      // empty package.json file
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: expect.not.stringMatching(/^[123]\./),
      exitCode: 0,
    });
  });
});

it(`should allow to call "corepack install" without arguments within a configured project`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@1.0.0`,
    });

    await expect(runCli(cwd, [`install`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });

    // Disable the network to make sure we don't succeed by accident
    process.env.COREPACK_ENABLE_NETWORK = `0`;

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `1.0.0\n`,
      stderr: ``,
      exitCode: 0,
    });
  });
});

it(`should refuse to run a different package manager within a configured project`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@1.0.0`,
    });

    process.env.FORCE_COLOR = `0`;

    await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
      stdout: ``,
      stderr: expect.stringContaining(`This project is configured to use yarn because ${
        npath.fromPortablePath(ppath.join(cwd, `package.json` as Filename))
      } has a "packageManager" field`),
      exitCode: 1,
    });

    // Disable strict checking to workaround the UsageError.
    process.env.COREPACK_ENABLE_STRICT = `0`;

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `1.0.0\n`,
      stderr: ``,
      exitCode: 0,
    });
    await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
      stdout: `${config.definitions.pnpm.default.split(`+`, 1)[0]}\n`,
      stderr: ``,
      exitCode: 0,
    });
  });
});


it(`should always use fallback version when project spec env is disabled`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@1.0.0`,
    });
    process.env.COREPACK_ENABLE_PROJECT_SPEC = `0`;

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `${config.definitions.yarn.default.split(`+`, 1)[0]}\n`,
      stderr: ``,
      exitCode: 0,
    });
    await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
      stdout: `${config.definitions.pnpm.default.split(`+`, 1)[0]}\n`,
      stderr: ``,
      exitCode: 0,
    });
  });
});

it(`should support disabling the network accesses from the environment`, async () => {
  process.env.COREPACK_ENABLE_NETWORK = `0`;

  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: ``,
      stderr: expect.stringContaining(`Network access disabled by the environment`),
      exitCode: 1,
    });
  });
});

describe(`read-only and offline environment`, () => {
  afterEach(async () => {
    const home = npath.toPortablePath(process.env.COREPACK_HOME!);
    await xfs.chmodPromise(ppath.join(home, `lastKnownGood.json`), 0o644);
    await xfs.chmodPromise(home, 0o755);
  });

  it(`should support running in project scope`, async () => {
    await xfs.mktempPromise(async cwd => {
      // Reset to default
      delete process.env.COREPACK_DEFAULT_TO_LATEST;

      // Prepare fake project
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        packageManager: `yarn@2.2.2`,
      });

      // $ corepack install
      await expect(runCli(cwd, [`install`])).resolves.toMatchObject({
        stdout: `Adding yarn@2.2.2 to the cache...\n`,
        stderr: ``,
        exitCode: 0,
      });

      // Make COREPACK_HOME ro
      const home = npath.toPortablePath(folderUtils.getCorepackHomeFolder());
      // Make a lastKnownGood.json file with not JSON-parsable content:
      await xfs.writeFilePromise(ppath.join(home, `lastKnownGood.json`), `{`);
      await xfs.chmodPromise(ppath.join(home, `lastKnownGood.json`), 0o444);
      await xfs.chmodPromise(home, 0o555);

      // Use fake proxies to simulate offline mode
      process.env.HTTP_PROXY = `0.0.0.0`;
      process.env.HTTPS_PROXY = `0.0.0.0`;

      // $ corepack yarn --version
      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        stdout: `2.2.2\n`,
        stderr: ``,
        exitCode: 0,
      });
    });
  });

  it(`should support running globally`, async () => {
    await xfs.mktempPromise(async installDir => {
      // Reset to default
      delete process.env.COREPACK_DEFAULT_TO_LATEST;

      await expect(runCli(installDir, [`enable`, `--install-directory`, npath.fromPortablePath(installDir), `yarn`])).resolves.toMatchObject({
        stdout: ``,
        stderr: ``,
        exitCode: 0,
      });

      await expect(runCli(installDir, [`install`, `--global`, `yarn@2.2.2`])).resolves.toMatchObject({
        stdout: `Installing yarn@2.2.2...\n`,
        stderr: ``,
        exitCode: 0,
      });

      // Make COREPACK_HOME ro
      const home = npath.toPortablePath(folderUtils.getCorepackHomeFolder());
      await xfs.chmodPromise(ppath.join(home, `lastKnownGood.json`), 0o444);
      await xfs.chmodPromise(home, 0o555);

      // Use fake proxies to simulate offline mode
      process.env.HTTP_PROXY = `0.0.0.0`;
      process.env.HTTPS_PROXY = `0.0.0.0`;

      await expect(runCli(installDir, [`yarn`, `--version`])).resolves.toMatchObject({
        stdout: `2.2.2\n`,
        stderr: ``,
        exitCode: 0,
      });
    });
  });
});

it(`should support hydrating package managers from cached archives`, async () => {
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`pack`, `yarn@2.2.2`])).resolves.toMatchObject({
      stderr: ``,
      exitCode: 0,
    });

    // Use a new cache
    process.env.COREPACK_HOME = npath.fromPortablePath(await xfs.mktempPromise());

    // Disable the network to make sure we don't succeed by accident
    process.env.COREPACK_ENABLE_NETWORK = `0`;

    await expect(runCli(cwd, [`install`, `-g`, `corepack.tgz`])).resolves.toMatchObject({
      stderr: ``,
      exitCode: 0,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `2.2.2\n`,
      stderr: ``,
      exitCode: 0,
    });
  });
});

it(`should support hydrating package managers if cache folder was removed`, async () => {
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`pack`, `yarn@2.2.2`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });

    // Use a new cache
    process.env.COREPACK_HOME = npath.fromPortablePath(await xfs.mktempPromise());

    // Simulate cache removal
    await xfs.removePromise(npath.toPortablePath(process.env.COREPACK_HOME));

    // Disable the network to make sure we don't succeed by accident
    process.env.COREPACK_ENABLE_NETWORK = `0`;

    await expect(runCli(cwd, [`install`, `-g`, `corepack.tgz`])).resolves.toMatchObject({
      stderr: ``,
      exitCode: 0,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `2.2.2\n`,
      stderr: ``,
      exitCode: 0,
    });
  });
});

it(`should support hydrating multiple package managers from cached archives`, async () => {
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`pack`, `yarn@2.2.2`, `pnpm@5.8.0`])).resolves.toMatchObject({
      exitCode: 0,
      stderr: ``,
    });

    // Use a new cache
    process.env.COREPACK_HOME = npath.fromPortablePath(await xfs.mktempPromise());

    // Disable the network to make sure we don't succeed by accident
    process.env.COREPACK_ENABLE_NETWORK = `0`;

    await expect(runCli(cwd, [`install`, `-g`, `corepack.tgz`])).resolves.toMatchObject({
      stderr: ``,
      exitCode: 0,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `2.2.2\n`,
      stderr: ``,
      exitCode: 0,
    });

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `pnpm@5.8.0`,
    });

    await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
      stdout: `5.8.0\n`,
      stderr: ``,
      exitCode: 0,
    });
  });
}, 180_000);

it(`should support running package managers with bin array`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    await expect(runCli(cwd, [`yarnpkg`, `--version`])).resolves.toMatchObject({
      stdout: `2.2.2\n`,
      stderr: ``,
      exitCode: 0,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      stdout: `2.2.2\n`,
      stderr: ``,
      exitCode: 0,
    });
  });
});

it(`should handle parallel installs`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    await expect(Promise.all([
      runCli(cwd, [`yarn`, `--version`]),
      runCli(cwd, [`yarn`, `--version`]),
      runCli(cwd, [`yarn`, `--version`]),
    ])).resolves.toMatchObject([
      {
        stdout: `2.2.2\n`,
        stderr: ``,
        exitCode: 0,
      },
      {
        stdout: `2.2.2\n`,
        stderr: ``,
        exitCode: 0,
      },
      {
        stdout: `2.2.2\n`,
        stderr: ``,
        exitCode: 0,
      },
    ]);
  });
});

it(`should not override the package manager exit code`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    const yarnFolder = ppath.join(npath.toPortablePath(folderUtils.getInstallFolder()), `yarn/2.2.2`);
    await xfs.mkdirPromise(yarnFolder, {recursive: true});
    await xfs.writeJsonPromise(ppath.join(yarnFolder, `.corepack`), {});

    await xfs.writeFilePromise(ppath.join(yarnFolder, `yarn.js`), `
      process.exitCode = 42;
    `);

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 42,
      stdout: ``,
      stderr: ``,
    });
  });
});

it(`should not preserve the process.exitCode when a package manager throws`, async () => {
  // Node.js doesn't preserve process.exitCode when an exception is thrown
  // so we need to make sure we don't break this behaviour.

  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    const yarnFolder = ppath.join(npath.toPortablePath(folderUtils.getInstallFolder()), `yarn/2.2.2`);
    await xfs.mkdirPromise(yarnFolder, {recursive: true});
    await xfs.writeJsonPromise(ppath.join(yarnFolder, `.corepack`), {});

    await xfs.writeFilePromise(ppath.join(yarnFolder, `yarn.js`), `
      process.exitCode = 42;
      throw new Error('foo');
    `);

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 1,
      stdout: ``,
      stderr: expect.stringContaining(`foo`),
    });
  });
});

it(`should not set the exit code after successfully launching the package manager`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    const yarnFolder = ppath.join(npath.toPortablePath(folderUtils.getInstallFolder()), `yarn/2.2.2`);
    await xfs.mkdirPromise(yarnFolder, {recursive: true});
    await xfs.writeJsonPromise(ppath.join(yarnFolder, `.corepack`), {});

    await xfs.writeFilePromise(ppath.join(yarnFolder, `yarn.js`), `
      process.once('beforeExit', () => {
        if (process.exitCode === undefined) {
          process.exitCode = 42;
        }
      });
    `);

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 42,
      stdout: ``,
      stderr: ``,
    });
  });
});

it(`should support package managers in ESM format`, async () => {
  await xfs.mktempPromise(async cwd => {
    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@2.2.2`,
    });

    const yarnFolder = ppath.join(npath.toPortablePath(folderUtils.getInstallFolder()), `yarn/2.2.2`);
    await xfs.mkdirPromise(yarnFolder, {recursive: true});
    await xfs.writeJsonPromise(ppath.join(yarnFolder, `.corepack`), {});

    await xfs.writeFilePromise(ppath.join(yarnFolder, `yarn.js`), `
      import 'fs';
      console.log(42);
    `);

    await xfs.writeJsonPromise(ppath.join(yarnFolder, `package.json`), {
      type: `module`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: `42\n`,
      stderr: ``,
    });
  });
});

describe(`should show a warning on stderr before downloading when enable`, () => {
  it(`when enabled by the environment`, async () => {
    await xfs.mktempPromise(async cwd => {
      process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = `1`;
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        packageManager: `yarn@3.0.0`,
      });
      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stdout: `3.0.0\n`,
        stderr: `! Corepack is about to download https://repo.yarnpkg.com/3.0.0/packages/yarnpkg-cli/bin/yarn.js\n`,
      });
    });
  });

  it(`should ignore setting in .corepack.env`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeFilePromise(
        ppath.join(cwd, `.corepack.env` as Filename),
        `COREPACK_ENABLE_DOWNLOAD_PROMPT=1\n`,
      );
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
        packageManager: `yarn@3.0.0`,
      });
      await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
        exitCode: 0,
        stdout: `3.0.0\n`,
        stderr: ``,
      });
    });
  });
});

it(`should be able to show the latest version`, async () => {
  process.env.COREPACK_DEFAULT_TO_LATEST = `1`;
  await xfs.mktempPromise(async cwd => {
    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: /^1\.\d+\.\d+\r?\n$/,
      stderr: ``,
    });

    // Should keep working if the home folder is removed
    await xfs.rmPromise(process.env.COREPACK_HOME as any, {recursive: true});
    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: /^1\.\d+\.\d+\r?\n$/,
      stderr: ``,
    });
  });
});

it(`should download yarn classic from custom registry`, async () => {
  await xfs.mktempPromise(async cwd => {
    process.env.COREPACK_NPM_REGISTRY = `https://registry.npmmirror.com`;
    process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = `1`;
    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: expect.stringMatching(/^1\.\d+\.\d+\r?\n$/),
      stderr: expect.stringMatching(/^! Corepack is about to download https:\/\/registry\.npmmirror\.com\/yarn\/-\/yarn-1\.\d+\.\d+\.tgz\r?\n$/),
    });

    // Should keep working with cache
    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: /^1\.\d+\.\d+\r?\n$/,
      stderr: ``,
    });
  });
});

it(`should download yarn berry from custom registry`, async () => {
  await xfs.mktempPromise(async cwd => {
    process.env.COREPACK_NPM_REGISTRY = `https://registry.npmmirror.com`;
    process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = `1`;

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      packageManager: `yarn@3.0.0-rc.2+sha224.f83f6d1cbfac10ba6b516a62ccd2a72ccd857aa6c514d1cd7185ec60`,
    });

    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: `3.0.0-rc.2\n`,
      stderr: `! Corepack is about to download https://registry.npmmirror.com/@yarnpkg/cli-dist/-/cli-dist-3.0.0-rc.2.tgz\n`,
    });

    // Should keep working with cache
    await expect(runCli(cwd, [`yarn`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: `3.0.0-rc.2\n`,
      stderr: ``,
    });
  });
});

it(`should download latest pnpm from custom registry`, async () => {
  await xfs.mktempPromise(async cwd => {
    process.env.AUTH_TYPE = `COREPACK_NPM_TOKEN`; // See `_registryServer.mjs`
    process.env.COREPACK_DEFAULT_TO_LATEST = `1`;
    process.env.COREPACK_INTEGRITY_KEYS = `0`;

    await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
    });

    await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
      exitCode: 0,
      stdout: `pnpm: Hello from custom registry\n`,
      stderr: ``,
    });

    // Should keep working with cache
    await expect(runCli(cwd, [`pnpm`, `--version`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: `pnpm: Hello from custom registry\n`,
      stderr: ``,
    });
  });
});

describe(`should pick up COREPACK_INTEGRITY_KEYS from env`, () => {
  beforeEach(() => {
    process.env.AUTH_TYPE = `COREPACK_NPM_TOKEN`; // See `_registryServer.mjs`
    process.env.COREPACK_DEFAULT_TO_LATEST = `1`;
  });

  it(`from env variable`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      });

      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: ``,
        stderr: expect.stringContaining(`No compatible signature found in package metadata`),
      });

      process.env.COREPACK_INTEGRITY_KEYS = `0`;
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 0,
        stdout: `pnpm: Hello from custom registry\n`,
        stderr: ``,
      });
    });
  });

  it(`from .corepack.env file`, async t => {
    // Skip that test on Node.js 18.x as it lacks support for .env files.
    if (process.version.startsWith(`v18.`)) t.skip();

    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      });

      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: ``,
        stderr: expect.stringContaining(`No compatible signature found in package metadata`),
      });

      await xfs.writeFilePromise(ppath.join(cwd, `.corepack.env` as Filename), `COREPACK_INTEGRITY_KEYS=0\n`);
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 0,
        stdout: `pnpm: Hello from custom registry\n`,
        stderr: ``,
      });
    });
  });

  it(`from env file defined by COREPACK_ENV_FILE`, async t => {
    // Skip that test on Node.js 18.x as it lacks support for .env files.
    if (process.version.startsWith(`v18.`)) t.skip();

    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      });

      await xfs.writeFilePromise(ppath.join(cwd, `.corepack.env` as Filename), `COREPACK_INTEGRITY_KEYS={}\n`);
      await xfs.writeFilePromise(ppath.join(cwd, `.other.env` as Filename), `COREPACK_INTEGRITY_KEYS=0\n`);

      // By default, Corepack should be using .corepack.env and fail.
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: ``,
        stderr: expect.stringContaining(`No compatible signature found in package metadata`),
      });

      process.env.COREPACK_ENV_FILE = `.other.env`;
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 0,
        stdout: `pnpm: Hello from custom registry\n`,
        stderr: ``,
      });
    });
  });

  it(`from env even if there's a .corepack.env file`, async () => {
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      });

      await xfs.writeFilePromise(ppath.join(cwd, `.corepack.env` as Filename), `COREPACK_INTEGRITY_KEYS={}\n`);

      // By default, Corepack should be using .corepack.env (or the built-in ones on Node.js 18.x) and fail.
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: ``,
        stderr: expect.stringContaining(`No compatible signature found in package metadata`),
      });

      process.env.COREPACK_INTEGRITY_KEYS = ``;
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 0,
        stdout: `pnpm: Hello from custom registry\n`,
        stderr: ``,
      });
    });
  });

  it(`should ignore .corepack.env file if COREPACK_ENV_FILE is set to 0`, async t => {
    // Skip that test on Node.js 18.x as it lacks support for .env files.
    if (process.version.startsWith(`v18.`)) t.skip();

    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      });

      await xfs.writeFilePromise(ppath.join(cwd, `.corepack.env` as Filename), `COREPACK_INTEGRITY_KEYS=0\n`);

      process.env.COREPACK_ENV_FILE = `0`;
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: ``,
        stderr: expect.stringContaining(`No compatible signature found in package metadata`),
      });

      delete process.env.COREPACK_ENV_FILE;
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 0,
        stdout: `pnpm: Hello from custom registry\n`,
        stderr: ``,
      });
    });
  });

  it(`from env file defined by COREPACK_ENV_FILE`, async t => {
    // Skip that test on Node.js 18.x as it lacks support for .env files.
    if (process.version.startsWith(`v18.`)) t.skip();

    process.env.COREPACK_ENV_FILE = `.other.env`;
    await xfs.mktempPromise(async cwd => {
      await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
      });

      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: ``,
        stderr: expect.stringContaining(`No compatible signature found in package metadata`),
      });

      await xfs.writeFilePromise(ppath.join(cwd, `.other.env` as Filename), `COREPACK_INTEGRITY_KEYS=0\n`);
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 0,
        stdout: `pnpm: Hello from custom registry\n`,
        stderr: ``,
      });
    });
  });
});

for (const authType of [`COREPACK_NPM_REGISTRY`, `COREPACK_NPM_TOKEN`, `COREPACK_NPM_PASSWORD`, `PROXY`]) {
  describe(`custom registry with auth ${authType}`, () => {
    beforeEach(() => {
      process.env.AUTH_TYPE = authType; // See `_registryServer.mjs`
      process.env.COREPACK_INTEGRITY_KEYS = ``;
    });

    it(`should download yarn classic`, async () => {
      await xfs.mktempPromise(async cwd => {
        await expect(runCli(cwd, [`yarn@1.x`, `--version`], true)).resolves.toMatchObject({
          exitCode: 0,
          stdout: `yarn: Hello from custom registry\n`,
          stderr: ``,
        });
      });
    });

    it(`should download yarn berry`, async () => {
      await xfs.mktempPromise(async cwd => {
        await xfs.writeJsonPromise(ppath.join(cwd, `package.json` as Filename), {
          packageManager: `yarn@3.0.0`,
        });

        await expect(runCli(cwd, [`yarn@5.x`, `--version`], true)).resolves.toMatchObject({
          exitCode: 0,
          stdout: `yarn: Hello from custom registry\n`,
          stderr: ``,
        });
      });
    });

    it(`should download pnpm`, async () => {
      await xfs.mktempPromise(async cwd => {
        await expect(runCli(cwd, [`pnpm@1.x`, `--version`], true)).resolves.toMatchObject({
          exitCode: 0,
          stdout: `pnpm: Hello from custom registry\n`,
          stderr: ``,
        });
      });
    });

    it(`should download custom package manager`, async () => {
      await xfs.mktempPromise(async cwd => {
        await expect(runCli(cwd, [`customPkgManager@https://registry.npmjs.org/customPkgManager/-/customPkgManager-1.0.0.tgz`, `--version`], true)).resolves.toMatchObject({
          exitCode: 0,
          stdout: `customPkgManager: Hello from custom registry\n`,
          stderr: ``,
        });
      });
    });
  });
}

describe(`handle integrity checks`, () => {
  beforeEach(() => {
    process.env.AUTH_TYPE = `COREPACK_NPM_TOKEN`; // See `_registryServer.mjs`
  });

  describe(`when signature matches`, () => {
    beforeEach(() => {
      process.env.TEST_INTEGRITY = `valid`; // See `_registryServer.mjs`
    });

    it(`should return no error when calling 'corepack use'`, async () => {
      await xfs.mktempPromise(async cwd => {
      // Skip rest of the test on Windows & Node.js 18.x as it inevitably times out otherwise.
        if (process.version.startsWith(`v18.`) && os.platform() === `win32`) return;

        // Removing home directory to force the "re-download"
        await xfs.rmPromise(process.env.COREPACK_HOME as any, {recursive: true});

        await Promise.all([
          expect(runCli(cwd, [`use`, `pnpm`], true)).resolves.toMatchObject({
            exitCode: 0,
            stdout: `Installing pnpm@1.9998.9999 in the project...\n\npnpm: Hello from custom registry\n`,
            stderr: ``,
          }),
          expect(runCli(cwd, [`use`, `yarn@1.x`], true)).resolves.toMatchObject({
            exitCode: 0,
            stdout: `Installing yarn@1.9998.9999 in the project...\n\nyarn: Hello from custom registry\n`,
            stderr: ``,
          }),
          expect(runCli(cwd, [`use`, `yarn@latest`], true)).resolves.toMatchObject({
            exitCode: 0,
            stdout: `Installing yarn@5.9999.9999 in the project...\n\nyarn: Hello from custom registry\n`,
            stderr: ``,
          }),
        ]);
      });
    });


    it(`should return no error when fetching latest version`, async () => {
      process.env.COREPACK_DEFAULT_TO_LATEST = `1`;
      await xfs.mktempPromise(async cwd => {
        await Promise.all([
          expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
            exitCode: 0,
            stdout: `pnpm: Hello from custom registry\n`,
            stderr: ``,
          }),
          expect(runCli(cwd, [`yarn@1.x`, `--version`], true)).resolves.toMatchObject({
            exitCode: 0,
            stdout: `yarn: Hello from custom registry\n`,
            stderr: ``,
          }),
          expect(runCli(cwd, [`yarn@5.x`, `--version`], true)).resolves.toMatchObject({
            exitCode: 0,
            stdout: `yarn: Hello from custom registry\n`,
            stderr: ``,
          }),
        ]);
      });
    });
  });
  it(`should return an error when signature does not match with a range`, async () => {
    process.env.TEST_INTEGRITY = `invalid_signature`; // See `_registryServer.mjs`

    await xfs.mktempPromise(async cwd => {
      await expect(runCli(cwd, [`pnpm@1.x`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Signature does not match`),
        stdout: ``,
      });
    });
  });
  it(`should return an error when signature does not match with a tag`, async () => {
    process.env.TEST_INTEGRITY = `invalid_signature`; // See `_registryServer.mjs`

    await xfs.mktempPromise(async cwd => {
      await expect(runCli(cwd, [`pnpm@latest`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Signature does not match`),
        stdout: ``,
      });
    });
  });
  it(`should return an error when hash does not match without a tag`, async () => {
    process.env.TEST_INTEGRITY = `invalid_integrity`; // See `_registryServer.mjs`
    process.env.COREPACK_DEFAULT_TO_LATEST = `1`; // Necessary as the version defined in `config.json` does not exist on the custom registry.

    await xfs.mktempPromise(async cwd => {
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringMatching(/Mismatch hashes. Expected [a-f0-9]{128}, got [a-f0-9]{128}/),
        stdout: ``,
      });
      // A second time to validate the invalid version was not cached.
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringMatching(/Mismatch hashes. Expected [a-f0-9]{128}, got [a-f0-9]{128}/),
        stdout: ``,
      });
      await expect(runCli(cwd, [`yarn`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringMatching(/Mismatch hashes. Expected [a-f0-9]{128}, got [a-f0-9]{128}/),
        stdout: ``,
      });
      await expect(runCli(cwd, [`use`, `pnpm`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: expect.stringMatching(/Mismatch hashes. Expected [a-f0-9]{128}, got [a-f0-9]{128}/),
        stderr: ``,
      });
    });
  });
  it(`should return an error when signature does not match without a tag`, async () => {
    process.env.TEST_INTEGRITY = `invalid_signature`; // See `_registryServer.mjs`
    process.env.COREPACK_DEFAULT_TO_LATEST = `1`; // Necessary as the version defined in `config.json` does not exist on the custom registry.

    await xfs.mktempPromise(async cwd => {
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Signature does not match`),
        stdout: ``,
      });
      // A second time to validate the invalid version was not cached.
      await expect(runCli(cwd, [`pnpm`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Signature does not match`),
        stdout: ``,
      });
      await expect(runCli(cwd, [`yarn`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Signature does not match`),
        stdout: ``,
      });
      await expect(runCli(cwd, [`use`, `pnpm`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: expect.stringContaining(`Signature does not match`),
        stderr: ``,
      });
    });
  });
  it(`should return an error when signature does not match when version is provided`, async () => {
    process.env.TEST_INTEGRITY = `invalid_signature`; // See `_registryServer.mjs`

    await xfs.mktempPromise(async cwd => {
      await expect(runCli(cwd, [`yarn@1.9998.9999`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringContaining(`Signature does not match`),
        stdout: ``,
      });
      await expect(runCli(cwd, [`use`, `yarn@1.9998.9999`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: expect.stringContaining(`Signature does not match`),
        stderr: ``,
      });
    });
  });
  it(`should return an error when hash does not match`, async () => {
    process.env.TEST_INTEGRITY = `invalid_integrity`; // See `_registryServer.mjs`

    await xfs.mktempPromise(async cwd => {
      await expect(runCli(cwd, [`yarn@1.9998.9999`, `--version`], true)).resolves.toMatchObject({
        exitCode: 1,
        stderr: expect.stringMatching(/Mismatch hashes. Expected [a-f0-9]{128}, got [a-f0-9]{128}/),
        stdout: ``,
      });
      await expect(runCli(cwd, [`use`, `yarn@1.9998.9999`], true)).resolves.toMatchObject({
        exitCode: 1,
        stdout: expect.stringMatching(/Mismatch hashes. Expected [a-f0-9]{128}, got [a-f0-9]{128}/),
        stderr: ``,
      });
    });
  });
  it(`should return no error when signature does not match when hash is provided`, async () => {
    process.env.TEST_INTEGRITY = `invalid_signature`; // See `_registryServer.mjs`

    await xfs.mktempPromise(async cwd => {
      const result = await runCli(cwd, [`yarn@1.9998.9999+sha1.deadbeef`, `--version`], true);
      expect(result).toMatchObject({
        exitCode: 1,
        stdout: ``,
      });
      const match = /Mismatch hashes. Expected deadbeef, got ([a-f0-9]{40})/.exec(result.stderr);
      if (match == null) throw new Error(`Invalid output`, {cause: result.stderr});
      await expect(runCli(cwd, [`yarn@1.9998.9999+sha1.${match[1]}`, `--version`], true)).resolves.toMatchObject({
        exitCode: 0,
        stdout: `yarn: Hello from custom registry\n`,
        stderr: ``,
      });
    });
  });
});
