[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / TestConfig

# Interface: TestConfig

## Properties

### additionalDependencies?

> `optional` **additionalDependencies**: `object`

Additional dependencies that can't be inferred from the project's package.json
or other explicit fields like "typescript.tsx.version".

#### Index Signature

\[`pkg`: `string`\]: `string`

***

### additionalFiles?

> `optional` **additionalFiles**: [`AdditionalFilesEntry`](../type-aliases/AdditionalFilesEntry.md)[]

If you would like to place additional files within the test projects

***

### entries

> **entries**: [`TestConfigEntry`](TestConfigEntry.md)[]

Logical unit separating out what test files should be run and under what conditions.

***

### matchIgnore?

> `optional` **matchIgnore**: `string`[]

A string of globs to ignore when searching for file test matches.  This is helpful for performance by ensuring that we skip scanning large
directories like node_modules.

Keep in mind that this glob is relative to rootDir.

(As a matter of performance, we don't scan node_modules, .yarn, or .git)

***

### packageJson?

> `optional` **packageJson**: `Omit`\<`PackageJson`, `"name"`\>

This will override the test Project PackageJson with the specific values

***

### rootDir?

> `optional` **rootDir**: `string`

The directory that we will match our globs against.  This path is relative to the directory with the pkgtest.config file.

#### Default

```ts
"./"
```
