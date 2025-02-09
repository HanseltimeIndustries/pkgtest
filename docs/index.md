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
3. Create some test script in the project
4. `npm run my-script` or `node my-script.js`
5. Manually verify that everything ran as you expected
6. 
The above is a great way to start understanding your package, but the likelihood that you want to do this for every package manager (and even some select versions that you maybe have to support), every tool to run, and every expected tsconfig is pretty
low (at least if you're me).

## The Solution - pkgtest

Enter `pkgtest`!  With pkgtest, we can create a set of script files that we want to execute to verify that nominal functionality
of the package is there and then a `pkgtest.config.[json|js|cjs|mjs|ts]` file to let us know what type of projects to scaffold.

Example Files:

=== "pkgtest.config.js"
    ```js
    module.exports = {
        entries: [
            {
                testMatch: "pkgtests/**/*.ts",
                runWith: ["node", "ts-node", "tsx"],
                pkgManager: ["yarn-v1", "yarn-berry", "npm", "pnpm"],
                moduleTypes: ["commonjs", "esm"],
                transforms: {
                    typescript: {}, // Use the defaults, but we do want typescript transformation
                },
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
Command to call:

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

Example output:

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

...Additional Tests
</code>
</pre>

As you can see, we've quickly created a set of projects, imported them and then run the typescript transformed files
with node or tsx under each of those projects!

You may have noticed that the example output isn't all that should be there according to the config file.  In reality, the output 
would run tests for:

* Package Managers: pnpm, yarn v1, yarn latest, npm
* Each library type: commonjs, ES Module
* Each node-like run tool: node, tsx, ts-node

That's a lot of bang for a single config file!
