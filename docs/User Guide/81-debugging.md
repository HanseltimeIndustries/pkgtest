# Debugging

As discussed in [Getting Started](../Getting%20Started/index.md), when a pkgtest run fails, you can debug each failed project.
This is a brief primer on how to perform that debugging.

## Scenario

The expected failures that aren't bugs with pkgtest that you will need to debug have to do with one of the test projects that
pkgtest sets up failing when importing your package.

This can happen in many different stages:

1. Installing the package
2. Compiling the package (via typescript)
3. Running the actual tests

In our experience, the best way to solve this is to go to the test project, tweak the package being imported or configurations in the 
test project, and then continue until you have solved the issue.

Let's use this embarassing mistake that we make with pkgtest v1.

In this scenario, we accidentally typo'd our esm configuration to point to a file that wasn't compiled:

```json title="package.json"
{
    "exports": {
		"types": "./dist/types/index.d.ts",
		"require": "./dist/cjs/index.js",
		"import": "./dist/esm/index.js",
		"default": "./dist/esm/index.js"
	},
}
```

In this scenario, when I used pkgtest locally in my commonjs library, I thought everything worked fine.  I had not yet created a file test
that imported pkgtest that would've failed.

Let's make that:

```typescript title="importTest.ts"
import { getTempProjectDirPrefix } from "@hanseltime/pkgtest";

// This should be enough to evaluate import traversal of all the files
getTempProjectDirPrefix();
```

Now, when we run `yarn pkgtest`, we should get some file tests failures.  If we look at the text, we should notice that all the commonjs 
tests pass but none of the esm.  However, let's say we just want to debug one test project at a time.

### --ipreserve

Let's go ahead and re-run pkgtest so that it doesn't immediately delete the test projects:

```shell
yarn pkgtest --ipreserve --modType esm
```

Since we know that commonjs wasn't a problem, we went ahead and just ran esm tests.

Once the tests run and fail, we should receive a prompt:

<pre>
<code>[runner] Tests failed fast
... previous
[runner] File Test Time:      13 s
[runner] Bin Test Time:       0 s
✔ Delete pkg for entry1: [esm, yarn-v1 (pkgtest default)]?
</code>
</pre>

Instead of saying `Y/n`, take the time to scroll up and find the test project that you want to debug.

<pre>
<code>
Test Suite for Module commonjs, Package Manager yarn-v1 (<span style="color:magenta">pkgtest default</span>), Run with node
Test package location: /tmp/pkgTest-XXXXXXfYsl8Z
<span style="color:blue">Test:</span> pkgtest/simpleRun.ts <span style="color:green">Passed</span> 872 ms
        corepack yarn@1.22.22 node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtest/importTest.js
<span style="color:blue">Test:</span> pkgtest/inner/index.ts <span style="color:green">Passed</span> 872 ms
        corepack yarn@1.22.22 node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtest/importTest.js
Passed: <span style="color:green">1</span>
Failed: <span style="color:red">0</span>
Skipped: 0
Not Run: 0
Total: 1
</code>
</pre>

In this case, let's just open up that folder in our IDE of choice.

```shell title(using VSCode)
code /tmp/pkgTest-XXXXXXhgjVy3
```

Now that I'm in this project, I can go ahead and run `yarn install` and see that it installs fine

I can now run: `corepack yarn@1.22.22 node /tmp/pkgTest-XXXXXXfYsl8Z/dist/cjs/pkgtest/importTest.js`

And I can see the same failure about a file not existing!

Now I can go ahead and update my package-under-test's package.json (presuming we tested around and realized the error),
and then in the test project run `yarn install` and re-run the test script.

```json title="package.json"
{
    "exports": {
		"types": "./dist/types/index.d.ts",
		"require": "./dist/cjs/index.js",
		"import": "./dist/esm/index.mjs",
		"default": "./dist/esm/index.mjs"
	},
}
```

Once it works, I can go back to my terminal that is still asking me if I want to delete.  If we think we've solved everything, we can just
answer yes to everything and then return `yarn pkgtest` to see if they all pass!