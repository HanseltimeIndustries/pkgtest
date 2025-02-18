[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / AddFilePerTestProjectCreate

# Type Alias: AddFilePerTestProjectCreate()

> **AddFilePerTestProjectCreate**: (`config`, `projectInfo`) => `Promise`\<\[`string`, `string`\]\> \| \[`string`, `string`\]

In the event that you need to do some more programmatic generation of files, you can provide a function
that will be invoked at the end of setting up the project.  This will provide file contents and the
relative file name that will be placed in the test project.

## Parameters

### config

[`TestConfig`](../interfaces/TestConfig.md)

This is the entire test config object that this function is found in

### projectInfo

[`CreateTestProjectInfo`](../interfaces/CreateTestProjectInfo.md)

If this is part of a test entry, then project info describing the current
			test project that is being created will be provided

## Returns

`Promise`\<\[`string`, `string`\]\> \| \[`string`, `string`\]

returns the file contents in the first spot and then the name of the file relative
         to the test project directory.
