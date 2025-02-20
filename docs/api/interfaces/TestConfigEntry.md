[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / TestConfigEntry

# Interface: TestConfigEntry

## Properties

### additionalDependencies?

> `optional` **additionalDependencies**: `object`

Additional dependencies that can't be inferred from the project's package.json
or other explicit fields like "typescript.tsx.version".

#### Index Signature

\[`pkg`: `string`\]: `string`

***

### additionalFiles?

> `optional` **additionalFiles**: ([`AdditionalFilesEntry`](../type-aliases/AdditionalFilesEntry.md) \| [`AddFilePerTestProjectCreate`](../type-aliases/AddFilePerTestProjectCreate.md))[]

If you would like to place additional files within the test projects

***

### binTests?

> `optional` **binTests**: [`BinTestConfig`](BinTestConfig.md)

If this is provided, this will also generate a test per package manager + module type combination
where each bin command provided is called accordingly

By default, if you provide an empty object, all commands will be run with --help

***

### fileTests?

> `optional` **fileTests**: [`FileTestConfig`](FileTestConfig.md)

***

### moduleTypes

> **moduleTypes**: [`ModuleTypes`](../enumerations/ModuleTypes.md)[]

A list of module types that we will import the package under test with.  If you are using typescript,
you will probably want the same configuration for both moduleTypes and will only need one TetsConfigEntry
for both.

If you are writing in raw JS though, you will more than likely need to keep ESM and CommonJS equivalent versions
of each package test and therefore will need to have an entry with ["commonjs"] and ["esm"] separately so that
you can change the testMatch to pick the correct files.

***

### packageJson?

> `optional` **packageJson**: `Omit`\<`PackageJson`, `"name"`\>

This will override the test Project PackageJson with the specific values

***

### packageManagers

> **packageManagers**: ([`PkgManager`](../enumerations/PkgManager.md) \| [`PkgManagerOptionsConfig`](PkgManagerOptionsConfig.md)\<[`PkgManager`](../enumerations/PkgManager.md)\>)[]

Which package managed we will use to install dependencies and run the various test scripts provided.

Important - to preserve integrity during testing, each module type will get a brand new project per package
manager to avoid dependency install and access issues.

***

### timeout?

> `optional` **timeout**: `number`

Number of milliseconds per test to allow before failing
