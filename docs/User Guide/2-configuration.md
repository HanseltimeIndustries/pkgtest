# Configuration

`pkgtest` is configured by a `pkgtest.config.[json|js|cjs|mjs|ts]` file at the root of the package you want to test.

The following will discuss the main concepts of the configuration file, but you can always check the [Config interface docs](../api/interfaces/TestConfig.md)
for a full set of features.

## matchRootdir

This is a relative path to the directory with the `pkgtest.config` file that limits where any `testMatch` patterns are applied relatively.  This is
helpful for:

1. reducing time to find tests (by minimizing the number of files to scan)
2. simplifying testMatch patterns to not have to worry about matching the other files (i.e. **/*.ts will only match in the matchRootDir)

Default: `./`

## matchIgnore

!!! Note

    Isolating your pkgtests to a single directory can negate the need to keep lots of matchIgnores since the folder will presumably only hold the tests you want

matchIgnore can take a list of glob patterns that will cause `pkgtest` to skip any search activity.  This is helpful for the same reasons as
`matchRootDir`.

Default: `**/node_modules/**, **/.yarn/**, **/.git/**`

## additionalDependencies

Additional Dependencies allows you to declare other packages that you want to include in each of the test projects that are created.  At the top level,
this means these dependencies will be added to every test entry (but will be overridden by any explicit `additionalDependencies` at the test entry level).

This is useful for more complex package test scripts:

```typescript title="pkgtests/test1.ts"
import { camelCase } from 'lodash'
import { someCamcelCaseFunc } from '@myscope/mypkg'

someCamelCaseFunc(cameCase('special-string'))
```

In that case, we would add:

```js title="pkgtest.config.js"
    additionalDependencies: {
        lodash: "^4.17.21",
    }
```

!!! warning

    Remember for typescript files to add the `@types/` dependency if the library doesn't export its own types.  You will run into typescript compilation
    errors about not being able to find declarations if not!

## Test Entries

If you've read [Getting Started](../1-getting-started.md), then you will probably have noticed that a single entry in the entries array can
create many Test Suites.  While you technically could create multiple entries to do the same thing as we did in getting started, that would make
your configuration file very repetitive and tedious to update or maintain.

!!! tip

    As a general rule of thumb, a test entry is a dividing line along the number of different projects that you would need (i.e. module type + package manger configuration + any transforms or unique file configurations needed).

### An example of multiple test entries

Normally, a single test entry that uses typescript as a transform and runs Node would be enough to test rendered js.  However,
for the sake of this example, let's say that we had a desire to use .ts files (proving our package works with transpilation) and
then to also use specifically compiled commonjs and es module javascript for some specific testing reason (perhaps typescript won't
transpile a less safe feature in js that we want to support).

=== "pkgtests/ts/test1.ts"
    ```
    import { func1 } from '@myscope/mypkg'

    func1();
    ```

=== "pkgtests/cjs/testSpecial1.js"
    ```
    const { funcSpecial } = require('@myscope/mypkt')
    // Let's pretend this is something exotic for cjs
    funcSpecial();
    ```

=== "pkgtests/esm/testSpecial1.js"
    ```
    import { funcSpecial } from '@myscope/mypkg'
    // Let's pretend this is something exotic for esm
    funcSpecial();
    ```

In this case, we would need 3 test entries since we'll have:

* one that applies transforms to .ts files
* one that runs just commonjs specific files (no transform)
* one that runs just esm specific files (no transform)

=== "commonjs project"
    ```js title="pkgtest.config.js"
    const pkgManagers = [ "yarn-v1", "yarn-berry", "npm", "pnpm" ]
    module.exports = {
        matchRootDir: 'pkgtests',
        entries: [
            {

                fileTests: {
                    testMatch: "ts/**/*.ts",
                    runWith: ["node", "ts-node", "tsx"],
                    transforms: {
                        typescript: {
                            version: '^5.0.0',
                            tsNode: {
                                version: '^10.9.2'
                            },
                            tsx: {
                                version: '^4.19.2',
                            },
                            nodeTypes: {
                                version: '^20.0.0',
                            } 
                        }
                    },
                },
                packageManagers: pkgManagers,
                moduleTypes: ["commonjs", "esm"],

            },
            {
                fileTests: {
                    testMatch: "cjs/**/*.js",
                    runWith: ["node"], // We can't run ts-node or tsx since these aren't ts files
                },
                packageManagers: pkgManagers,
                moduleTypes: ["commonjs"], // We also don't want to run commonjs in esm projects so just commonjs
            },
            {
                fileTests: {
                    testMatch: "esm/**/*.js",
                    runWith: ["node"], // We can't run ts-node or tsx since these aren't ts files
                },
                packageManagers: pkgManagers,
                moduleTypes: ["esm"], // We also don't want to run esm in commonjs projects so just esm
            }
        ]
    }
    ```
=== "esm project"
    ```js title="pkgtest.config.js"
    export default {
        matchRootDir: 'pkgtests',
        entries: [
            {

                fileTests: {
                    testMatch: "ts/**/*.ts",
                    runWith: ["node", "ts-node", "tsx"],
                    transforms: {
                        typescript: {
                            version: '^5.0.0',
                            tsNode: {
                                version: '^10.9.2'
                            },
                            tsx: {
                                version: '^4.19.2',
                            },
                            nodeTypes: {
                                version: '^20.0.0',
                            } 
                        }
                    },
                },
                packageManagers: pkgManagers,
                moduleTypes: ["commonjs", "esm"],

            },
            {
                fileTests: {
                    testMatch: "cjs/**/*.js",
                    runWith: ["node"], // We can't run ts-node or tsx since these aren't ts files
                },
                packageManagers: pkgManagers,
                moduleTypes: ["commonjs"], // We also don't want to run commonjs in esm projects so just commonjs
            },
            {
                fileTests: {
                    testMatch: "esm/**/*.js",
                    runWith: ["node"], // We can't run ts-node or tsx since these aren't ts files
                },
                packageManagers: pkgManagers,
                moduleTypes: ["esm"], // We also don't want to run esm in commonjs projects so just esm
            }
        ]
    }
    ```

#### What if we had some bin commands?

The above test configuration covers us wanting to test the programmatic API of our library.  But let's say we also provided some CLI 
commands that used sommething like Clipanion to basically call our programmatic api in target ways.

```json title="package.json
{
    "name": "mypkg",
    "bin": {
        "command1": "dist/bin/command1.js",
        "command2": "dist/bin/command2.js"
    }

}
```

If you've written command line scripts, you have probably run into one or two of the "gotcha" scenarios about tools not running your
perfectly transpiled script (missing hashbangs anyone?).  You also may want to make sure that the cli doesn't have any commonjs/esm
runtime failures in it, etc.

For any test entry, we can enable testing of the bin scripts within each of the projects that are created by adding the `binTests`
field.

```javascript
{
    matchRootDir: 'pkgtests',
    entries: [
        {  
            fileTests: {
                testMatch: "ts/**/*.ts",
                runWith: ["node", "ts-node", "tsx"],
                transforms: {
                    typescript: {
                        version: '^5.0.0',
                        tsNode: {
                            version: '^10.9.2'
                        },
                        tsx: {
                            version: '^4.19.2',
                        },
                        nodeTypes: {
                            version: '^20.0.0',
                        } 
                    }
                },
            },
            packageManagers: pkgManagers,
            moduleTypes: ["commonjs", "esm"],
            binTests: {
                command1: [
                    {
                        args: '--dry-run something',
                    },
                    {
                        args: '--pretty-print here',
                        env: {
                            PRETTINESS: super
                        }
                    }
                ]
                // command2 will just be run with the --help default that pkgtest supplies
            }
        },
    // LEAVE THE OTHER CONFIGS ALONE
    ]
}

```

The above modification now means that for every project created by our .ts test files entry, we will run additional tests that
look like:

* `<package manager> command1 --dry-run something`
* `<package manager> command1 --pretty-print here`
  * With an environment variable set of `PRETTINESS=super`
* `<package manager> command2 --help`

!!! note

    We only added `binTests` to the typescript configuration test entry because, in this case, we only cared about running against
    a certain set of package managers and module projects.  The subsequent .js test entries were using effectively the same project
    and in our case wouldn't affect the script.

    In the event that we wanted to test how our script interpreted a tsconfig.json file or the lack of one, then we would have had
    a reason to add binTests to the js entries (or make our own).

    If we also wanted to test different configuration files for our script, we may have added more entries then as well.

## Test Entry Options

### packageManagers

!!! Tip

   The number of unique test projects created is `packageManagers` * `moduleTypes`

The packageManagers field indicates which types of package managers we want to ensure our package works with.  Which means,
installation + running of the given scripts under that package manager's running system (i.e. `yarn node script`)

#### Simple Package Manager Types

At its simplest, you can specify any of the corresponding strings in the [PkgManager enum](../api/enumerations/PkgManager.md) and pkgtest will 
set up a minimal configuration of the latest package manager project.

This generally involves running `corepack use <package manager>@latest` or in the case of `yarn-v1`, `corepack use yarn@1,x`.

This does mean that the package manager's default configuration behavior is tested, which in some cases may not be the full functionality that
you want to test.  (The example given in [getting starterd](../1-getting-started.md) was that yarn plug'n'play is not the same behavior as its
other simpler and less costly `nodeLinker` modes - which for some might be fine enough when covered via `npm` and `pnpm`).

!!! note

    In general, simple package manager strings will test compatibility with the latest, default configuration of a package manager.
    This does mean that there is a **slight** moving target in terms of your testing, since a new bugged release of the package manager
    could suddenly cause tests to fail.

    It is this package's opinion that you should want that type of functionality so that you can get ahead of failures that might be coming
    down the pipeline for your package as a result of package management tooling issues.

#### Advanced Package Manager Configurations

For each simple package manager type, you can choose to create any number of advanced configurations that look like:

```js 
{
    packageManager: 'yarn-berry',
    alias: 'my fixed version config',
    version: 'optional fixed version',
    options: {
        // Package Manager specific options
    }
}
```

See [PkgManagerOptionsConfig](../api/interfaces/PkgManagerOptionsConfig.md) for the current options api.

The [getting-started](../1-getting-started.md) guide worked through adding an additional entry for `yarn berry with a node-modules nodeLinker strategy`.
If you'd like the details of that, please take a look there.

##### Example Scenario

In addition to adding node-modules linking from getting-started, let's pretend that we work at SomeCompany Industries and that some ambitious engineer set up an entire
toolchain boilerplate around `pnpm` and ended up adding lots of wrappers that expect very specific features of the `9.x` version (there's a backlog
ticket somewhere to update the framework to support new APIs but we need to support it until then).

In that case, we want to make sure that our package works within the `9.x` version of `pnpm` so that we can avoid debugging other teams' boilerplates
when they use our package.

```js
{
    packageManager: 'pnpm',
    alias: 'pnpm 9.x for internal framework',
    version: '9.x',
    options: {}
}
```

Well that was pretty simple!  Now, we're guaranteed to make sure things work with pnpm@9.x anytime we run `pkgtest`.

!!! question

    The advanced options types are some of the least complete features for `pkgtest`.  Any suggestions for extending a
    particular packageManager's setup options are welcome!  Please submit an issue and maybe a PR if you're ambitous.

### moduleTypes

!!! Tip

   The number of unique test projects created is `packageManagers` * `moduleTypes`

The largest reason for this library actually stems fromk the commonjs to esm compatibility issues that have been around for years.
As a library package publisher, I have been bit by the "it works on my machine" problem many times over because I thought I transpiled something
for ES Modules or CommonJS only to find out that ts-node or node fails at runtime in some exotic way.  (A simple example is that we never
transformed use of `__filename` to `import.meta` based lookups or vice versa (node will halt execution immediately in commonjs mode if it sees `import.meta`)).

If you're trying to support commonjs and esm in your package, then the chances that you have a larger transpilation chain are pretty high.  And as such,
you'll want to make sure that the end transpiled project works nominally in other projects.

The moduleTypes field indicates that we want to set up a project as either a `commonjs` or `esm` project and then run the same scripts.  Under the hood,
pkgtest sets up some basic defaults (i.e. running ts-node in a compatible way with esm or setting up typescript to transpile to `ESNext` module type).

!!! warning

    Keep in mind that, if you're not doing transformation via the typescript transform field and are instead importing explicitly written commonjs or
    esm javascript files for tests, you will want to make sure that you don't run a `commonjs` project with `esm` tests, since that will fail due to
    the inherent differences in code.  Please see the Test Entries example above.

### additionalDependencies

Adds additional dependencies to the test projects.  This will override any top-level `additionalDependencies` as well as any tool versions that might
have been explicitly detailed in the test config enntry.

See the top level `additionalDependencies` for an example use case.

### fileTests

When supplied, this indicates that pkgtest will be finding actual js/ts test files and executing them as part of the test.  See [File Tests](./1-test-types.md#file-tests)

#### testMatch

Each test entry will find and copy over all tests within the `matchRootDir` that match the glob pattern.

The pattern is relative to the matchRootDir and is still subject to any `matchIgnore` patterns.

For example:

```js
    matchRootDir: "pkgtests",
    matchIgnore: "fixtures/**/*"
    entries: [
        {
            testMatch: "**/*.ts"
            // other options
        }
    ]
```

This means that only `.ts` files within `pkgtests` will be matched but none within `pkgtests/fixtures/`.

```shell hl_lines="3 5 6"
mypkg/
  pkgtests/
    test1.ts
    someGrouping/
      test2.ts
      test3.ts
    fixtures/
      someConfigfile.ts
  src/
    index.ts
    something.ts
  pkgtest.config.js
  package.json
```

#### runWith

As alluded to in other discussions, `pkgtest` aims to verify ways that people might try and run your library.  Currently, the supported runWith options
are [here](../api/enumerations/RunWith.md).

For tools that are typescript based like `ts-node` and `tsx`, you will be required to provide a typescript transform object since `pkgtest` needs
to set up a tsconfig file.

#### transforms

Transforms returns to any transformations to the supplied test file that we expect to do.  Currently, we only support typescript.

If transforms is specified, `pkgtest` will configure the specified tool and then run the equivalent of a build call for the tool to compile
the code to .js.

Transform works directly with `runWith`.  If the tool requires the transform (i.e. tsx requires typescript), it will be used directly with the tool that
runs.  If the `runWith` is something like node, where it actually relies on the output of the transform, then `pkgtest` will point each `node` call to 
the approriately compiled file as the result of the transform.

In general, using a typescript transform as part of a single test entry is the recommneded way to go since you can test typescript and transpile it to 
either esm or commonjs for node based tests as well.

##### typescript

The typescript object can be completely empty of fields if desired.  In that case, it will follow the [dependency lookup](./3-dependency-lookup.md) for
any typescript related libraries.  Just like with the default package manager settings, this type of configuration may result in having a shifting target
for tooling that runs transforms (in regards to different version fields) but might be desirable from a shifting target standpoint.

If you do not have the required dependencies in your package.json for dependency lookup, then you will have to provide at a minimum, those missing
version values here.  This might be desirable if you don't want to pollute your package.json with tools that your project does not want to use.

For instance, if you want to test with `ts-node` but make the decision to only use `tsx` for running development scripts in your projects, you would
need to tell `pkgtest` what version of `ts-node` to use:

```js
    transforms: {
        typescript: {
            tsNode: {
                version: '^9.0.0' // Any npm version is allowed here - you can fix it to a specific version if you want to ensure that version works
            }
        }
    }
```

The above configuration means that you don't need to list ts-node in your project's dependencies since it is not a development tool.

##### config

The config field can be provided to override tsconfig fields.

!!! warn

    If you wish to override something like target, keep in mind that you will need to create multiple test entries since something like `ESNext`
    does not work with a commonjs module.

### binTests

When supplied, this indicates that pkgtest will construct tests for every "bin" entry in your package.json.  See [Bin Tests](./1-test-types.md#bin-tests)

#### per bin key tests

You can specify the tests for each bin file by adding a field of the same name as the bin in your `package.json`.

```javascript
{
    command1: [
        {
            args: "-f someValue"
        },
        {
            args: "something",
            env: {
                SPECIALVAR: 'value',
            }
        }
    ]
}
```