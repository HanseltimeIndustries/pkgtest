[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / FileTestConfig

# Interface: FileTestConfig

## Properties

### runWith

> **runWith**: [`RunWith`](../enumerations/RunWith.md)[]

The various ways that you want to run the scripts in question to verify they work as expected.
Note, we will run each way per package manager + module project that is created.

***

### testMatch

> **testMatch**: `string`

A glob patterned string from the cwd (the package root) that will identify any pkgTest files to copy into
respective package tests and then run.

***

### transforms?

> `optional` **transforms**: `object`

Transforms that need to be run on the raw tests that were found via testMatch and copied into the project.

If none are provided, then you can only use runWith tools that can operate directly on js and we expect
the files to be in the correct raw js flavor

#### typescript

> **typescript**: [`TypescriptOptions`](TypescriptOptions.md)
