# Overview

Have you ever run into the problem of publishing an npm package that works fine on your computer, only to find out
that the package fails in an exotic way when you:

* import it into a different module type package (commonjs, esm)
* use a different package manager (yarn plug'n'play, etc.)
* run with a new tool (ts-node, etc.)
* use a different transpiler (typescript vs straight .js)

This library seeks to help solve the above problems by standardizing and abstracting away all of the custom setups that
you would need to otherwise implement on every npm package that you author in order to test these things.

## The Inspiration - manual testing

There are plenty of guides out there that detail how you can locally test the npm package that you are creating.  In general,
they follow the pattern of (using npm as an example):

1. `npm init <my test project>`
2. `npm install <path to package>`
3. Either/or
      * Test imports by:
         1. Creating some test script in the project
         2. `npm run my-script` or `node my-script.js`
      * Test a bin script by:
         1. `npx my-bin <my args>`
4. Manually verify that everything ran as you expected

The above is a great way to start understanding your package, but the likelihood that you want to do this for every package manager 
(and even some select versions that you maybe have to support), every tool to run, and every expected tsconfig is pretty
low (at least if you're me).

## The Solution - pkgtest

Enter `pkgtest`!  With pkgtest, we can perform two types of tests:

1.  [FileTests](./api/enumerations/TestType.md#file) 
        
    These allow you to write a short script in order to verify the nominal functionality of importing your package in js/ts

2.  [BinTests](./api/enumerations/TestType.md#bin) 
   
    These allow you to test each [bin declaration](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin) in your package.json
    so that you're sure they run nominally under each package environment.

These tests are all configured in a single `pkgtest.config.[json|js|cjs|mjs|ts]` file, which lets pkgtest take care of
scaffolding all the different permutations of projects that import our package.

Example call:

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
    pnpx pkgtest
    ```

<pre>
<code>
Test Suite for Module commonjs, Package Manager yarn-v1 (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-XXXXXXfYsl8Z
<span style="color:blue">Test:</span> pkgtest/simpleRun.ts <span style="color:green">Passed</span> 872 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtest/simpleRun.js
<span style="color:blue">Test:</span> pkgtest/inner/index.ts <span style="color:green">Passed</span> 872 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtest/inner/index.js
Passed: <span style="color:green">2</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 2


Test Suite for Module commonjs, Package Manager yarn-v1 (<span style="color:magenta">pkgtest default</span>), Run with tsx
Test package location: /tmp/pkgTest-XXXXXXfYsl8Z
<span style="color:blue">Test:</span> pkgtest/simpleRun.ts <span style="color:green">Passed</span> 317 ms
        corepack yarn@1.x tsx /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtest/simpleRun.js
<span style="color:blue">Test:</span> pkgtest/inner/index.ts <span style="color:green">Passed</span> 301 ms
        corepack yarn@1.x tsx /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtest/inner/index.js
Passed: <span style="color:green">2</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 2


Test Suite for Module commonjs, Package Manager yarn-berry (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-XXXXXXhgjVy3
<span style="color:blue">Test:</span> pkgtest/simpleRun.ts <span style="color:green">Passed</span> 631 ms
        corepack yarn@latest node /tmp/pkgTest-XXXXXXhgjVy3/dist/cjs/pkgtest/simpleRun.js
<span style="color:blue">Test:</span> pkgtest/inner/index.ts <span style="color:green">Passed</span> 575 ms
        corepack yarn@latest node /tmp/pkgTest-XXXXXXhgjVy3/dist/cjs/pkgtest/inner/index.js
Passed: <span style="color:green">2</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 2

...Additional File Tests...

Test Suite for Module esm, Package Manager yarn-berry (yarn node linked), Package Bin Commands
Test package location: /tmp/pkgTest-XXXXXXhgjVy3
Test:  corepack yarn@latest pkgtest --help <span style="color:green">Passed</span> 682 ms
        corepack yarn@latest pkgtest --help:
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 1

...Additional Bin Tests...

[runner] File Test Suites:  <span style="color:green">24 passed</span>, 24 total
[runner] File Tests:        <span style="color:green">48 passed</span>, 48 total
[runner] Bin Test Suites:  <span style="color:green">8 passed</span>, 8 total
[runner] Bin Tests:        <span style="color:green">8 passed</span>, 8 total
[runner] Setup Time:       11.094 s
[runner] File Test Time:   40.655 s
[runner] Bin Test Time:    10.442 s
</code>
</pre>

As you can see, we've quickly created a set of test projects that import our package, set up some test files in these projects,
and then run the typescript transformed test files with node or tsx under each of those projects!

Additionally, in each of those test projects, we've run `<our bin> --help` to make sure that the command at least runs in each.
(If any of you have forgotten a hashbang before, you know the pain)

That's a lot of bang for a single config file!

### The example files in question

!!! Note

    Please use examples from [Getting Started](./1-getting-started.md) if you're trying to test out pkgtest.

Example Files:

=== "pkgtest.config.js"
    ```js
    module.exports = {
        entries: [
            {
                fileTests: {
                    testMatch: "pkgtests/**/*.ts",
                    runWith: ["node", "ts-node", "tsx"],
                    transforms: {
                        typescript: {}, // Use the defaults, but we do want typescript transformation
                    },
                },
                binTests: {}, // This means pkgtest will run any default --help test on any bin entry
                packageManagers: ["yarn-v1", "yarn-berry", "npm", "pnpm"],
                moduleTypes: ["commonjs", "esm"],
                // No additional files needed
            },
        ]
    }
    ```
=== "pkgtests/simpleTest.ts"
    ```typescript
    import { someFunc } from 'my-package'

    // Call someFunc to make sure it works nominally
    someFunc()
    ```
=== "pkgtests/inner/index.ts"
    ```typescript
    import { someFunc2 } from 'my-package'

    // Call someFunc2 to make sure it works nominally
    someFunc2()
    ```
=== "package.json"
    ```json
    {
        "name": "@hanseltime/pkgtest",
        "bin": {
            "pkgtest": "./dist/bin/pkgtest.js",
        },
        // The rest of the manifest
    }
    ```