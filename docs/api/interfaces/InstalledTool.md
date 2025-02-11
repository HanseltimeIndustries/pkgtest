[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / InstalledTool

# Interface: InstalledTool

## Extended by

- [`TsNodeRun`](TsNodeRun.md)
- [`TsxRun`](TsxRun.md)
- [`TypescriptOptions`](TypescriptOptions.md)

## Properties

### version?

> `optional` **version**: `string`

Explicit version to test.  If not supplied, we will use the
dependency/devDependency of the testing project or throw an error if we can't find anything
