# Testing Custom Scenarios

If you were to create a standard npm package, you probably would be happy with file tests as detailed in [Getting started](./index.md)
and with any bin tests for any CLI entrypoints that you would define for your package.

However, what if you were building something like a plugin within a framework?

In that case, you would want to know that your plugin works when it is imported into different configured projects and the other tool is
called with a configuration to use your plugin.

In this case, this is where Script Tests come in.

## Example plugin

Let's go ahead and set up a simple yarn berry plugin to illustrate this (adapted from [here](https://yarnpkg.com/advanced/plugin-tutorial)):

=== "package.json"
    ```json
    {
        "name": "yarn-simple-hello",
        "version": "0.0.1",
        "description": "Say hello",
        "main": "lib/index.js",
    }
    ```
=== "tsconfig.json"
    ```json
    {
        "module": "commonjs",
        "moduleResolution": "node",
        "target": "es2020",
        "outDir": "lib",
        "rootDir": "src"
        // Other fields
    }
    ```
=== "src/index.ts"
    ```typescript
    import type {
        Plugin,
    } from "@yarnpkg/core";

    export const name = "yarn-simple-hello";
    export function factory(require: <T>(pkg: string) => T): Plugin {
        const {BaseCommand} = require(`@yarnpkg/cli`);

        class HelloWorldCommand extends BaseCommand {
        static paths = [[`hello`]];

        async execute() {
            this.context.stdout.write(`This is my very own plugin 😎\n`);
        }
        }

        return {
        commands: [
            HelloWorldCommand,
        ],
        };
    }
    ```

Unpacking this a little, we have a single typescript file that we will transpile to lib/index.js, which is a yarn berry plugin.
For yarn, you actually need to commit your compiled file and have people point to it to use it (via github's raw view if you're
hosting on github).

Locally, we can use our own transpiled file by setting this in `.yarnrc.yml`:

```yaml
plugins:
  - ./lib/index.js
```

Let's say that, now, you want to verify that your plugin works correctly with yarn-berry in each linker configuration.  And that you
want to run it on CI against different environment (windows, mac, ubuntu).

## pkgtest config

To test the hello script that we built, let's set up our `pkgtest.config.js`:

=== "commonjs project"
    ```js title="pkgtest.config.js"
    const { join } = require("path");

    const baseYarnrc = {
        plugins: [
            join(__dirname, 'lib', 'index.js')
        ]
    }

    const nodeLinkedYarnBerry = {
        alias: "yarn node linked",
        packageManager: "yarn-berry",
        options: {
            yarnrc: {
                nodeLinker: "node-modules",
                ...baseYarnrc
            },
        },
    };

    const pnpmLinkedYarnBerry = {
        alias: "yarn pnpm linked",
        packageManager: "yarn-berry",
        options: {
            yarnrc: {
                nodeLinker: "pnpm",
                ...baseYarnrc
            },
        },
    };

    const pnpLinkedYarnBerry = {
        alias: "yarn pnp linked",
        packageManager: "yarn-berry",
        options: {
            yarnrc: {
                nodeLinker: "pnp",
                ...baseYarnrc
            },
        },
    };

    let packageManagers = [
        nodeLinkedYarnBerry,
        pnpLinkedYarnBerry,
        pnpmLinkedYarnBerry,
    ];

    module.exports = {
        rootDir: "pkgtest",
        locks: true,
        matchIgnore: ["fixtures/**"],
        entries: [{
            scriptTests: [
                {
                    name: "testHello",
                    script: "yarn hello"
                }
            ],
            packageManagers,
            moduleTypes: ["commonjs", "esm"],
            timeout: 3000,
        }],
    };
    ```


Let's unpack the above pkgtest config a bit

### scriptTests

```javascript
    setupTests: [
        {
            name: "testHello",
            script: "yarn hello"
        }
    ]
```

This section declares that we will:

1. Add a script to each test project's package.json that looks like `"testHello": "yarn hello"`
2. Run a Script Test Suite that will call `<pkg manager> testHello` as its sole test in each test project and validate if it exits with a 0

### PackageManagers

Now that we have the ability to call anything, we need to make sure that everything else is inside of the
project before we get to our script test.  In our case, since we already can configure the .yarnrc.yml, we 
just go ahead and configure it with a fully resolved path to our compiled file.

```.yarnrc.yml
nodeLinker: pnpm
plugins:
    - /full/path/to/pkg/lib/index.js
```

## Running it

Let's go ahead and run pkgtest:

```shell
yarn tsc  # Make sure you've compiled your bin file
yarn pkgtest
```

You should now see some new test suites reported:

<pre>
<code>
...Additional Tests Tests...

Test Suite for Module esm, Package Manager yarn-berry (yarn node linked), Package Scripts
Test package location: /tmp/pkgTest-XXXXXXhgjVy3
Test:  corepack yarn@latest testHello <span style="color:green">Passed</span> 682 ms
        corepack yarn@latest testHello:
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 1

[runner] File Test Suites:  <span style="color:green">0 passed</span>, 0 total
[runner] File Tests:        <span style="color:green">0 passed</span>, 0 total
[runner] Bin Test Suites:  <span style="color:green">0 passed</span>, 0 total
[runner] Bin Tests:        <span style="color:green">0 passed</span>, 0 total
[runner] Script Test Suites:  <span style="color:green">6 passed</span>, 6 total
[runner] Script Tests:        <span style="color:green">6 passed</span>, 6 total
[runner] Setup Time:       2.131 s
[runner] File Test Time:   0 s
[runner] Bin Test Time:    0 s
[runner] Script Test Time: 3.223 s
</code>
</pre>

### Understanding the output

<pre>
<code>
Test Suite for Module esm, Package Manager yarn-berry (yarn node linked), Package Scripts
Test package location: /tmp/pkgTest-XXXXXXhgjVy3
Test:  corepack yarn@latest testHello <span style="color:green">Passed</span> 682 ms
        corepack yarn@latest testHello:
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 1
</code>
</pre>

#### Script Test Suite

This is the output for a Script Test Suite.  As you can see, a script test suite is the run of all script entries in the `scriptTests` array
for a given project configured for `module type + package manager configuration`.  They are denoted by the `Package Scripts` string.

!!! tip
    Try adding another script entry to your package.json and re-run (`"testHello2": "yarn hello"`).  You should see 2 tests
    now in the suite.

#### Script Test

<pre>
<code>
Test:  corepack yarn@latest testHello <span style="color:green">Passed</span> 682 ms
        corepack yarn@latest testHello:
</code>
</pre>

This one's pretty straight forward.  Each script is considered a test and is run once.  We did that here.
If this were a script that we wanted to run across multiple package managers with different run syntax you would see that reflected
in the test of the respective test suite `npm run testHello`

## Conclusion

The above is a fairly bare bones example of setting up a script in test projects.  Hopefully, this can help get your mind running on other set
ups.

As a simple though exercise, if I were to set up an [SWC](https://swc.rs) plugin package, I could set up package test with:

* additionalDependencies for `@swc/core` `@swc/cli`
* additionalFiles of a `.swcrc`, and a file to transpile
* a script test to run `swc` 
* Optionally, I could get even fancier and write a quick .js script to read the expected output file and check for certain updates
  * In that case, this would be another additionalFile and my script might look like `swc && verify.js`