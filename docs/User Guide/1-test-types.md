# Test Types

pkgtest has the concept of two different types of tests that is can run on your behalf.

1. File Tests

    These are tests where we are testing how the programmatic api of the package performs:

    ```javascript
    import { myFunc } from 'myLibrary';

    normalUse() {
        myFun();
    }

    normalUse();
    ```

2. Bin Tests

    These are tests where we are explicitly making sure that our cli exposed bin commands from 
    your package.json are behaving as expected.

    Unlike File Tests, you are not writing your own script entrypoint, but instead providing arguments
    that you would like to verify work when the underlying `<package manager> <binCmd>` is called to verify
    that it works.

3. Script Tests

    These are tests where we create an entry in the package.json `scripts` field and then call it using the package manager
    of the currently configured test project.  Each script test object in your array is evaluated as a separate call
    and evaluated to see if it exited with a 0 code.

    This is the most free-form script and we recommend that you arrive at its need for things that require invoking other
    tools to test your own package's integration like a jest plugin, etc.

    [Custom Script Getting Started](../Getting%20Started/3-custom-scripts.md)

!!! note

    Bin, Script, and File Tests are set up to be able to run in the same `package manager alias + module type` configured project.
    This is partly to introduce a testing environment for bin/scripts that mirror the more boilerplated environment
    of real projects.  It also allows us to avoid creating additional test projects just to test bin commands.

## Shared Configurations

A given test entry may end up creating Bin and File Tests, and because of this, some of the entry's fields are shared:

* packageManagers
* moduleTypes
* additionalDependencies
* additionalFiles

In essence, anything that describes how the test project is set up is shared.

## File Tests

File tests are uniquely configured by:

* runWith
* testMatch
* transforms

As touched on in other sections of this site, the number of file tests that you have are directly
related to the number of test files that you write and then match with the `testMatch` glob.

## Bin Tests

Bin tests are turned off by default unless you provide a `binTests` object.

Unlike file tests, that require you to provide a glob to tell pkgtest where to look to find files,
pkgtest can do more of the lifting for you because you have to provide the [bin](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin)
field in your package.json.

As soon as Bin Tests are enabled for a test entry, pkgtest will automatically create/require at least one test
per bin script.  By default, the script will simply run the `--help` command.  However, you can provide the bin command
as a key and then an array of actual command arguments as separate tests.

```javascript
    binTests: {
        mycommand: [
            {
                args: '--filter someFilter posArg'
            },
            {
                args: '-h'
            }
        ]
    }
```

The above configuration will run two tests per test package for the "mycommand" argument.

## Script tests

Script tests are very simply an array of names for scripts and their actual content.

```javascript
scriptTests: [
    {
        name: "script1",
        script: "jest"
    },
    {
        name: "script2",
        script: "jest --someOption",
    }
]
```

Since script tests can involve calling anything, take special care to make sure your dependencies are installed and any
configuration files are available for their test projects.