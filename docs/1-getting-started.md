# Getting Started

## Install

=== "yarn"
    ```shell
    yarn add --dev @hanseltime/pkgtest
    ```
=== "npm"
    ```shell
    npm install --save-dev @hanseltime/pkgtest
    ```
=== "pnpm"
    ```shell
    pnpm add --save-dev @hanseltime/pkgtest
    ```

## Create a test

Assuming that your package.json declares a package name like:

```json title="package.json"
{
    "name": "@myscope/mypkg",
    // The rest of the package
}
```

You will want to create a `pkgtests/` folder in the root of the package you are hoping to test.

!!! warning

    If you are using typescript, make sure to add `pkgtest/` to the `"exclude"` field of your tsconfig.  Otherwise,
    typescript will run into issues trying to import the package that it is supposed to be compiling.

Create a file: `pkgtests/test1.ts`

```typescript title="pkgtest/test1.ts"
// TODO: uncomment this with any functions you want to make sure run correctly
// import { todo } from '@myscope/mypkg';

console.log('This worked!')
```

## Create a configuration file

Now that you have created a place to house your pkgtest tests, you should create a configuration to reference those tests.

Let's go ahead and create a `pkgtest.config.js`:

=== "commonjs project"
    ```js title="pkgtest.config.js"
    module.exports = {
        rootDir: "pkgtests",
        entries: [
            {
                fileTests: {
                    testMatch: "pkgtests/**/*.ts",
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
                packageManagers: [
                    "yarn-v1",
                    "yarn-berry",
                    "npm", 
                    "pnpm",
                ],
                moduleTypes: ["commonjs", "esm"],
                // No additional files needed
            },
        ]
    }
    ```
=== "esm project"
    ```js title="pkgtest.config.js"
    export default {
        rootDir: "pkgtests",
        entries: [
            {
                fileTests: {
                    testMatch: "pkgtests/**/*.ts",
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
                packageManagers: [
                    "yarn-v1",
                    "yarn-berry",
                    "npm", 
                    "pnpm",
                ],
                moduleTypes: ["commonjs", "esm"],
                // No additional files needed
            },
        ]
    }
    ```

### Translating the above config:

#### 1. The number of testing projects created

```js
    packageManagers: ["yarn-v1", "yarn-berry", "npm", "pnpm"],
    moduleTypes: ["commonjs", "esm"],
```

Creates a new fake testing package for `yarn v1`, `yarn-berry`, `npm`, and `pnpm` and each as `commonjs` or `esm` package type.
This means that there will be 8 testing package folders created.

#### 2. The scripts that will be run

```js
    fileTests: {
        testMatch: "pkgtests/**/*.ts",
    }
```

This means that all `.ts` files in the `pkgtests/` (`rootDir`) directory will be copied into each project and run.
In our case, that is just `pkgtests/tests1.ts`.

#### 3. Transformation

```js
    fileTests: {
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
    }
```

If you think about the fact that we provided a typescript file `test1.ts` as a test, there has to be
some way to translate that typescript file to actionable javascript.  Because of this, we provide the typescript
transform option with specific versions of `typescript`, `@types/node`, `tsx` and `tsNode`.  These will be the versions
installed and run for building of the typescript file or running it via `runWith` (see the following section).  This configuration
option tells pkgtest to make sure to set up a tsconfig file and use it when either compiling or running a typescript tool.

#### 4. How to run the test files

```js
    fileTests: {
        runWith: ["node", "ts-node", "tsx"],
    }
```

For each testing package that was created, we will run the test files (in this case, just `test1.ts`) via the run methods
provided.

If we assume a `yarn-v1` project, this would look like:

| runWith | cli call (effective) |
|---------------|-----------------|
| node | yarn node dist/pkgtests/test1.js |
| ts-node | yarn ts-node src/pkgtests/test1.ts |
| tsx | yarn tsx src/pkgtests/test1.ts |

The ins and outs of the actual calls are a bit more complex, but for a "getting started" document, you can think of these as being the effective calls that run the test files you wrote.

## Run the tests

=== "yarn"
    ```shell
    yarn pkgtest
    ```
=== "npm"
    ```shell
    npx pkgtest
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest
    ```

Take a look at the output of one test suite:

<pre>
<code>Test Suite for Module commonjs, Package Manager yarn-v1 (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-XXXXXXfYsl8Z
<span style="color:blue">Test:</span> pkgtests/test1.ts <span style="color:green">Passed</span> 631 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtests/test1.js
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 1
</code>
</pre>

### Understanding the output

#### File Test Suite

In pkgtest, a Test Suite is a collection of same style tests in a given environment.
So far we've been working with [file tests](./User%20Guide/1-test-types.md#file_tests), which are ways of testing your programmatic
APIs on import.
For a file test, a test suite is all files run under `module type` + `package manager`  + `pkg manager config alias` + `runWith`.  
The suite's test project is located in your os's temporary directory and, after all installation and compiling, it consists of
running the specific run command for the `runWith` we specified.

The <code>(<span style="color:magenta">pkgtest default</span>)</code> is the default pkgtest configuration of
the package manager.  For the most part, this is a good approximation of the latest package manager of x type with a minimal
project setup.  There are more advanced configuration options that allow you to add an alias for more controlled package
manager setups.

#### File Test

<pre>
<code>
<span style="color:blue">Test:</span> pkgtests/test1.ts <span style="color:green">Passed</span> 631 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtests/test1.js
</code>
</pre>

To avoid any confusion about failures for a given test, the actual command that `pkgtest` uses to run the test files are provided
underneath the name of the matched file that we created.

In this case, we can see that:

1. pkgtest is using corepack to enforce the correct package manager version
2. we are calling node inside of the yarn v1 resolution system
3. the file we're calling is located in a `dist/cjs/pkgtests/test1.js`, which was compiled by `pkgtest` (and is tracked by `pkgtest` so you don't have to worry too much about it).

## Troubleshooting a test

Now that we've seen what a working set of tests looks like, let's simulate a failing test.

Let's create a `testFail.ts` file in our `pkgTests` folder and write the following:

```typescript title="pkgtests/testFail.ts"
throw new Error('Oh no!')
```

Now, if we run pkgtest again, we should get failures.

!!! note

    `pkgtest` is pretty rudimentary about how tests pass.  If the exit code of a script is 0, it counts as a pass.

=== "yarn"
    ```shell
    yarn pkgtest
    ```
=== "npm"
    ```shell
    npx pkgtest
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest
    ```

Now when we look at one of the test suites, we can see that we have:

<pre>
<code>Test Suite for Module commonjs, Package Manager yarn-v1 (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-XXXXXYXfsl8ZA
<span style="color:blue">Test:</span> pkgtests/test1.ts <span style="color:green">Passed</span> 151 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtests/test1.js
<span style="color:blue">Test:</span> pkgtests/testFail.ts <span style="color:red">Failed</span> 400 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXYXfsl8ZA/dist/cjs/pkgtests/testFail.js:
file:///tmp/pkgTest-XXXXXYXfsl8ZA/dist/cjs/pkgtests/testFail.js:3
throw new Error('Oh no!');
      ^

Error: Oh no!
    at file:///tmp/pkgTest-XXXXXYXfsl8ZA/dist/cjs/pkgtests/testFail.js:3:7
    at ModuleJob.run (node:internal/modules/esm/module_job:234:25)
    at async ModuleLoader.import (node:internal/modules/esm/loader:473:24)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:122:5)

Passed: <span style="color:green">1</span>
Failed: <span style="color:red">1</span>
Skipped: 0
Not Run: 0
Total: 2
</code>
</pre>

Right off the bat, you can see that `pkgtest` will always print out the stdout and stderr for a failing test process.  You can also see anything that
node or the respective tool might be giving you in terms of debug outputs.

### That's WAY TOO MUCH Info

You may have been very annoyed to see `pkgtest` continue to spit out consistently failing test suites for every package that the config created for
us.  I am too.  By default, `pkgtest` is committed to reporting all results like most testing frameworks, however, if we just want to see if something
failed and then avoid the time cost of running everything else (maybe in CI or in our case, while debugging), we can use `--failFast`.

Let's re-run with:

=== "yarn"
    ```shell
    yarn pkgtest --failFast
    ```
=== "npm"
    ```shell
    npx pkgtest --failFast
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest --failFast
    ```

Now we can see the same test suite failure but just 1!  As soon as a single test fails, we stop the execution of that suite and we also
stop any further test suites from running.

### But what do I do with the failure?

If you were eager to debug this, you may have already tried to open the tests package that reported failure.  In the above example, that would be
`Test package location: /tmp/pkgTest-XXXXXYXfsl8ZA`.  If you did, you found out that this folder does not exist.  So what's going on?

Since `pkgtest` is fundamentally setting up projects on your file system (defaulting to the os temp directory), we want the program to not use up
lots of disk space.  Because of this, on every finish of the `pkgtest`, it will delete all temporary packages that it created by default.  In
our case though, we want to be able to go to the specifically configured project and understand why it's failing.

We can use the `--preserve` flag for this:

=== "yarn"
    ```shell
    yarn pkgtest --failFast --preserve
    ```
=== "npm"
    ```shell
    npx pkgtest --failFast --preserve
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest --failFast --preserve
    ```

Now you should see something like
:
<pre>
<code>[runner] Tests failed fast
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-TsUzXm</span>
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-5BwQKv</span>
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-buliyv</span>
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-1hxcGE</span>
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-pVUKGa</span>
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-kznGH4</span>
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-3AAYst</span>
[runner] <span style="color:orange">Skipping deletion of /tmp/pkgTest-9T6uFn</span>
</code>
</pre>

??? note "Why so many folders?"

    The way pkgtest works is that it will setup every project first (package install + transformation), before
    it then runs the test files in the various directories created.  Because of this, we have more packages than
    just the one that failed in `--failFast` mode.  A suggestion for different functionality is welcome if there
    is a use case for it.

### Let's debug!

Now you can open up the test folder location and do some debugging.  In our case, we can re-run the script for the test
and see what happens.

```
corepack yarn@1.x node dist/cjs/pkgtests/testFail.js
```

In our case, we know what the error is, but if we imagine that something like `yarn plug'n'play` is throwing runtime errors when 
we import a library that is not listed in its dependencies (part of `strict` mode), then we would want to run this command and make
tweaks to our current project until the script passes.

In some cases, maybe a bug in a package manager or compilation tool requires some sort of work around.  In that case, you might want to
make the appropriate config options (not part of getting started) and then note that in your library's installation documentation.

## Filtering tests

[Complete Documentation](./User%20Guide/3-filtering-tests.md)

Now that you have a grasp on running and debugging tests, we can talk about test filtering.  Like with other test frameworks,
running all tests all the time (or even just some until the first failure), can become tedious and a time sink during development.  

### CLI options

`pkgtest` provides a way for you to ensure that only particular tests and even test projects are created and run:

#### [testMatch]

`pkgtest` will take any number of last arguments as glob patterns to match to test files.  The glob patterns are relative to your current working
directory (the directory with your config file).  Let's see if we can reduce the noise of test output to just view the failed tests:

=== "yarn"
    ```shell
    yarn pkgtest "**/testFail.ts"
    ```
=== "npm"
    ```shell
    npx pkgtest "**/testFail.ts"
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest "**/testFail.ts"
    ```

The above command will only run the tests that result from `pkgtests/testFail.ts`:

<pre>
<code>Test Suite for Module commonjs, Package Manager yarn-v1 (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-XXXXXYXfsl8ZA
<span style="color:blue">Test:</span> pkgtests/test1.ts <span style="color:orange">Skipped</span> 0 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtests/test1.js
<span style="color:blue">Test:</span> pkgtests/testFail.ts <span style="color:red">Failed</span> 400 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXYXfsl8ZA/dist/cjs/pkgtests/testFail.js:
file:///tmp/pkgTest-XXXXXYXfsl8ZA/dist/cjs/pkgtests/testFail.js:3
throw new Error('Oh no!');
      ^

Error: Oh no!
    at file:///tmp/pkgTest-XXXXXYXfsl8ZA/dist/cjs/pkgtests/testFail.js:3:7
    at ModuleJob.run (node:internal/modules/esm/module_job:234:25)
    at async ModuleLoader.import (node:internal/modules/esm/loader:473:24)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:122:5)

Passed: <span style="color:green">1</span>
Failed: <span style="color:red">1</span>
Skipped: 0
Not Run: 0
Total: 2
</code>
</pre>

#### [--modType]

This will only run the test suites that match the moduleType that you want.

Example: `--modType commonjs` will only run any projects configured as `commonjs`

#### [--pkgManager]

This will only run the test suites that match the packageManager types that you want.

Example: `--modType yarn-v1` will only run any configurations that would use yarn-v1 in its test project

#### [--runWith]

This will only run the test suites that match the type of runWith parameter.

Example: `--runWith tsx node` will only run any configurations that would run test files with `node` or `tsx`

#### [--pkgManagerAlias]

As discussed above, since there are various package manager configurations, you can specify a specific alias for configured package manager.
This is especially helpful when you are setting up custom configurations (a good example is `yarn-berry` and its different `nodeLinker` fields).

By default, the non-advanced package manager configurations use the alias: `pkgtest default`

Example: `--pkgManagerAlias nodeLinker` would only run tests in a test package that had been set up with a package manager that matched the config 
with an alias specified as `nodeLinker`

### Running just one suite and test

Using the CLI options, we can now constrain pkgtest to run just 1 suite and 1 test for us to better debug.

=== "yarn"
    ```shell
    yarn pkgtest --modType esm --pkgManager pnpm --runWith tsx -- "**/testFail.ts"
    ```
=== "npm"
    ```shell
    npx pkgtest --modType esm --pkgManager pnpm --runWith tsx -- "**/testFail.ts"
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest --modType esm --pkgManager pnpm --runWith tsx -- "**/testFail.ts"
    ```

<pre>
<code>...Additional skips
[runner] <span style="color:orange">Skipping Suite:</span> Test Suite for Module esm, Package Manager pnpm (<span style="color:magenta">pkgtest default</span>), Run with node
[runner] <span style="color:orange">Skipping Suite:</span> Test Suite for Module esm, Package Manager pnpm (<span style="color:magenta">pkgtest default</span>), Run with ts-node
Test Suite for Module esm, Package Manager pnpm (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-4FQ1HZ
Test:  pkgtests/test1.ts <span style="color:orange">Skipped</span> 0 ms
        corepack pnpm@latest tsx --tsconfig tsconfig.esm.json /tmp/pkgTest-4FQ1HZ/src/pkgtests/test1.ts
Test:  pkgtests/testFail.ts <span style="color:red">Failed</span> 402 ms
        corepack pnpm@latest tsx --tsconfig tsconfig.esm.json /tmp/pkgTest-4FQ1HZ/src/pkgtests/testFail.ts:
file:///tmp/pkgTest-4FQ1HZ/src/pkgtests/testFail.ts:3
throw new Error("Oh no!");
      ^

Error: Oh no!
    at file:///tmp/pkgTest-4FQ1HZ/src/pkgtests/testFail.ts:3:7
    at ModuleJob.run (node:internal/modules/esm/module_job:234:25)
    at async ModuleLoader.import (node:internal/modules/esm/loader:473:24)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:122:5)

Node.js v20.18.2

Passed: 0
Failed: <span style="color:red">1</span>
Skipped: <span style="color:orange">1</span>
Not Run: 0
Total: 2
</code>
</pre>

At the top of the CLI output, you can see all the skipped suites!

Also,

* Only the pnpm, esm project was created
* It only ran the file test via `tsx`
* It only ran `testFail.ts`

## Testing bin commands

All of our preceding configuration involved us testing that our package imports and runs within other scripts (just like someone using our package
as a library).  Now though, let's assume that we've added a `bin` entry to our `package.json` so that people can use our tool via the cli.

In this case, we're counting on the package manager to fire up the binary we provided (under the hood this looks like a node-like call).  Given that the
package manager is making decisions for us though, we probably want to test the bin script that we're creating under those package manager constraints
(and any module loading limitations of commonjs vs esm).

Let's go ahead and add a pretend cli command (assuming you have a typescript project set up):

=== "package.json"
    ```json
    {
        "name": "mypkg",
        "bin": {
            "hello": "dist/bin/hello.js",
        }
        // Other fields and dependencies
    }
    ```
=== "tsconfig.json"
    ```json
    {
        "module": "commonjs",
        "moduleResolution": "node",
        "target": "es2020",
        "outDir": "dist",
        "rootDir": "src"
        // Other fields
    }
    ```
=== "src/bin/hello.ts"
    ```typescript
    console.log("hello!")
    ```

To add test the hello script that we build, let's modify our test entry:

=== "commonjs project"
    ```js title="pkgtest.config.js" hl_lines="4"
    module.exports = {
        entries: [
            {
                binTests: {},
                fileTests: {
                    testMatch: "pkgtests/**/*.ts",
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
                packageManagers: [
                    "yarn-v1",
                    "yarn-berry",
                    "npm", 
                    "pnpm",
                ],
                moduleTypes: ["commonjs", "esm"],
                // No additional files needed
            },
        ]
    }
    ```
=== "esm project"
    ```js title="pkgtest.config.js" hl_lines="4"
    export default {
        entries: [
            {
                fileTests: {
                    binTests: {},
                    testMatch: "pkgtests/**/*.ts",
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
                packageManagers: [
                    "yarn-v1",
                    "yarn-berry",
                    "npm", 
                    "pnpm",
                ],
                moduleTypes: ["commonjs", "esm"],
                // No additional files needed
            },
        ]
    }
    ```

Let's go ahead and run pkgtest:

```shell
yarn tsc  # Make sure you've compiled your bin file
yarn pkgtest
```

You should now see some new test suites reported:

<pre>
<code>
...Additional Tests Tests...

Test Suite for Module esm, Package Manager yarn-berry (yarn node linked), Package Bin Commands
Test package location: /tmp/pkgTest-XXXXXXhgjVy3
Test:  corepack yarn@latest hello --help <span style="color:green">Passed</span> 682 ms
        corepack yarn@latest hello --help:
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 1

[runner] File Test Suites:  <span style="color:green">24 passed</span>, 24 total
[runner] File Tests:        <span style="color:green">24 passed</span>, 24 total
[runner] Bin Test Suites:  <span style="color:green">8 passed</span>, 8 total
[runner] Bin Tests:        <span style="color:green">8 passed</span>, 8 total
[runner] Setup Time:       11.094 s
[runner] File Test Time:   40.655 s
[runner] Bin Test Time:    10.442 s
</code>
</pre>

### Understanding the output

<pre>
<code>
Test Suite for Module esm, Package Manager yarn-berry (yarn node linked), Package Bin Commands
Test package location: /tmp/pkgTest-XXXXXXhgjVy3
Test:  corepack yarn@latest hello --help <span style="color:green">Passed</span> 682 ms
        corepack yarn@latest hello --help:
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 1
</code>
</pre>

#### Bin Test Suite

This is the output for a Bin Test Suite.  As you can see, a bin test suite is the run of all bin commands
in a given project for `esm + package manager configuration`.  They are denoted by the `Package Bin Commands` string.

!!! tip
    Try adding another bin entry to your package.json and re-run (`"hello2": "dist/bin/hello.js"`).  You should see 2 tests
    now in the suite.

#### Bin Test

<pre>
<code>
Test:  corepack yarn@latest hello --help <span style="color:green">Passed</span> 682 ms
        corepack yarn@latest hello --help:
</code>
</pre>

You may have also noticed that, even though we provided no arguments to `binTests`, pkgtest went ahead and created a test
for `hello`.  The hello test is just it's cli call and it uses `--help` as a flag.

By default, pkgtest will scan all `bin` entries in your package.json and create a `--help` cli
call.  pkgtest will then consider an exit code 0 to be a success on these bin calls.

##### Specific Arguments 

Given how simple our cli call is, `--help` doesn't do anything for us (it doesn't even thrown an unrecognized flag error).  If we wanted
to be a bit more correct about out test, we can override the arguments that pkgtest uses.

```javascript
    binTest: {
        hello: [
            {
                args: "",
            },
        ],
    }
```

Now, pkgtest will only run one test for hello and will call just hello with no args.

!!! tip

    Try adding a second entry with different args.  When you re-run, you should see 2 `hello` tests.

## Testing yarn berry (node-modules resolution)

The pkgtest config file that we created is sufficient for testing each of the major package managers
at their latest default setting.  However, yarn berry actually implements a variety of resolution functionalities.

The default resolution (yarn plug'n'play) attempts to enforce things like strict dependencies and zero-installs,
but that also means that plug'n'play behaves more differently than yarn in a more traditional resolution mode.

One particular example, is that yarn plug'n'play in strict mode is able to do upfront dependency evaluation of
each `import`.  If the package doing the import is using a library that is not in its `dependencies` field, it will throw an early error
during run time and let you know that it won't run because the package is attempting to use a library that it does not, itself,
require.  Whether using plug'n'play or not, you will still get a failure at runTime if you have a dependency that isn't installed, but
yarn plug'n'play's message is more helpful than the traditional way of debugging a missing package (which generally involves
having to trace down a "cannot call x on undefined" message and then realizing that some transient dependency on your system
was filling the gap but not on your production system).

While yarn plug'n'play does provide benefits like the one detailed above, there are also performance costs and added complexity (i.e.
importing some third party library with packages incorrectly declared in devDependencies and then forcing yarn to still run it).  This means 
that, as a package maintainer, we should expect that a large number of people using yarn berry may have switched back to the simpler
`node-modules` or `pnpm` nodelinker configurations of yarn.

### Adding a new package manager config

At this point, we've reached the limits of the simple `packageManager` strings.  We already have a `yarn-berry` entry, and that default is
yarn plug'n'play (or whatever yarn berry defaults to in the future).  So let's add another entry:


=== "commonjs project"
    ```js title="pkgtest.config.js"
    module.exports = {
        entries: [
           {
                fileTests: {
                    binTests: {},
                    testMatch: "pkgtests/**/*.ts",
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
                packageManagers: [
                    "yarn-v1",
                    "yarn-berry",
                    "npm", 
                    "pnpm",
                    {
                        alias: "yarn berry node-modules",
                        packageManager: 'yarn-berry',
                        options: {
                            yarnrc: {
                                nodeLinker: 'node-modules'
                            }
                        }
                    }
                ],
                moduleTypes: ["commonjs", "esm"],
                // No additional files needed
            },
        ]
    }
    ```
=== "esm project"
    ```js title="pkgtest.config.js"
    export default {
        entries: [
            {
                fileTests: {
                    binTests: {},
                    testMatch: "pkgtests/**/*.ts",
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
                packageManagers: [
                    "yarn-v1",
                    "yarn-berry",
                    "npm", 
                    "pnpm",
                    {
                        alias: "yarn berry node-modules",
                        packageManager: 'yarn-berry',
                        options: {
                            yarnrc: {
                                nodeLinker: 'node-modules'
                            }
                        }
                    }
                ],
                moduleTypes: ["commonjs", "esm"],
                // No additional files needed
            },
        ]
    }
    ```

That's it!  Now when you run `pkgtest` you can see that there is a set of <code>yarn-berry (<span style="color:magenta">yarn berry node-modules</span>)</code> test suites that ran.  And now we are sure that both yarn and yarn operating under node-modules resolution works!