# Testing CLI (bin) Entries

The initial [getting-started](./index.md) page involved us testing that our package imports and runs within other scripts (just like someone using our package
as a library).  Now though, let's assume that we've added a `bin` entry to our `package.json` so that people can use our tool via the cli.

In this case, we're counting on the package manager to fire up the binary we provided (under the hood this looks like a node-like call).  Given that the
package manager is making decisions for us though, we probably want to test the bin script that we're creating under those package manager constraints
(and any module loading limitations of commonjs vs esm).

Let's go ahead and add a pretend cli command to our project (assuming you have a typescript project set up):

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

To test the hello script that we built, let's modify our `pkgtest.config.js` from the initial getting-started:

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
        ],
        locks: false,
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
        ],
        locks: false,
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