# Filtering tests

## CLI options

`pkgtest` provides a way for you to ensure that only particular tests and even test projects are created and run:

### [testMatch]

`pkgtest` will take any number of last arguments as glob patterns to match to test files.  The glob patterns are relative to your `rootDir`.

=== "yarn"
    ```shell
    yarn pkgtest "**/test2.ts"
    ```
=== "npm"
    ```shell
    npx pkgtest "**/test2.ts"
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest "**/test2.ts"
    ```

Assuming we have a `rootDir: "pkgtests"`, the above command will only run the tests that result from `pkgtests/test2.ts`:

<pre>
<code>Test Suite for Module commonjs, Package Manager yarn-v1 (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-XXXXXYXfsl8ZA
<span style="color:blue">Test:</span> pkgtests/test1.ts <span style="color:orange">Skipped</span> 0 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtests/test1.js
<span style="color:blue">Test:</span> pkgtests/test2.ts <span style="color:green">Passed</span> 400 ms
        corepack yarn@1.x node /tmp/pkgTest-XXXXXYXfsl8ZA/dist/cjs/pkgtests/test2.js

Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: <span style="color:orange">1</span>
Not Run: 0
Total: 2
</code>
</pre>

### [--modType]

!!! note

    This does not create new test projects, it only filters the test projects that would be created via your config file.

This will only run the test suites that match the moduleType that you want.

Example: `--modType commonjs` will only run any projects configured as `commonjs`

### [--pkgManager]

!!! note

    This does not create new test projects, it only filters the test projects that would be created via your config file.

This will only run the test suites that match the packageManager types that you want.

Example: `--modType yarn-v1` will only run any configurations that would use yarn-v1 in its test project

### [--runWith]

!!! note

    This does not create new test projects, it only filters the test projects that would be created via your config file.

This will only run the test suites that match the type of runWith parameter.

Example: `--runWith tsx node` will only run any configurations that would run test files with `node` or `tsx`

### [--pkgManagerAlias]

!!! note

    This does not create new test projects, it only filters the test projects that would be created via your config file.

You can specify a specific alias for configured package manager. This is especially helpful when you are setting up custom configurations (a good example is `yarn-berry` and its different `nodeLinker` fields).

By default, the non-advanced package manager configurations use the alias: `pkgtest default`

Example: `--pkgManagerAlias nodeLinker` would only run tests in a test package that had been set up with a package manager that matched the config 
with an alias specified as `nodeLinker`

### [--testType]

!!! note

    This does not create new test projects, it only filters the test projects that would be created via your config file.

This option allows you to only run a specific [type of test](./1-test-types.md).

Example: `--testType bin` will only run bin tests

### [--no filter options]

All of the filter options above have a `--no` option as well.  Instead of performing an `only` operation, these will run all tests that
don't match the no filter.

`--noTestType`, `--noModType`, `--noRunWith`, `--noPkgManager`, `--noPkgManagerAlias`

## Running just one suite and test

Using the CLI options, we can now constrain pkgtest to run just 1 suite and 1 test for us to better debug.

=== "yarn"
    ```shell
    yarn pkgtest --modType esm --pkgManager pnpm --runWith tsx -- "**/test2.ts" --testType file
    ```
=== "npm"
    ```shell
    npx pkgtest --modType esm --pkgManager pnpm --runWith tsx -- "**/test2.ts" --testType file
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest --modType esm --pkgManager pnpm --runWith tsx -- "**/test2.ts" --testType file
    ```

<pre>
<code>...Additional skips
[runner] <span style="color:orange">Skipping Suite:</span> Test Suite for Module esm, Package Manager pnpm (<span style="color:magenta">pkgtest default</span>), Run with node
[runner] <span style="color:orange">Skipping Suite:</span> Test Suite for Module esm, Package Manager pnpm (<span style="color:magenta">pkgtest default</span>), Run with ts-node
Test Suite for Module esm, Package Manager pnpm (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-4FQ1HZ
Test:  pkgtests/test1.ts <span style="color:orange">Skipped</span> 0 ms
        corepack pnpm@latest tsx --tsconfig tsconfig.esm.json /tmp/pkgTest-4FQ1HZ/src/pkgtests/test1.ts
Test:  pkgtests/test2.ts <span style="color:green">Passed</span> 402 ms
        corepack pnpm@latest tsx --tsconfig tsconfig.esm.json /tmp/pkgTest-4FQ1HZ/src/pkgtests/test2.ts

Passed: 0
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: <span style="color:orange">1</span>
Not Run: 0
Total: 2

[runner] File Test Suites:  <span style="color:green">1 passed</span>, <span style="color:orange">23 skipped</span>, 24 total
[runner] File Tests:        <span style="color:green">1 passed</span>,  <span style="color:orange">47 skipped</span>, 48 total
[runner] Bin Test Suites:  <span style="color:green">0 passed</span>, <span style="color:orange">8 skipped</span>, 8 total
[runner] Bin Tests:        <span style="color:green">0 passed</span>, <span style="color:orange">8 skipped</span>, 8 total
[runner] Setup Time:       3.094 s
[runner] File Test Time:   2.655 s
[runner] Bin Test Time:    0 s
</code>
</pre>

At the top of the CLI output, you can see all the skipped suites!

Also,

* Only the pnpm, esm project was created
* It only ran file tests via `tsx`
* It only ran `test2.ts`