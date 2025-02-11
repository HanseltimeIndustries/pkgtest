[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / TypescriptOptions

# Interface: TypescriptOptions

## Extends

- [`InstalledTool`](InstalledTool.md)

## Properties

### config?

> `optional` **config**: `Partial`\<`TsConfigJson`\>

Typescript configuration that is merged with the base typescript that is created

***

### nodeTypes?

> `optional` **nodeTypes**: [`InstalledTool`](InstalledTool.md)

The version of the @types/node

***

### tsNode?

> `optional` **tsNode**: [`TsNodeRun`](TsNodeRun.md)

Required if ts-node is included in the runBy section

***

### tsx?

> `optional` **tsx**: [`TsxRun`](TsxRun.md)

Required if Tsx is included in the runBy section

***

### version?

> `optional` **version**: `string`

Explicit version to test.  If not supplied, we will use the
dependency/devDependency of the testing project or throw an error if we can't find anything

#### Inherited from

[`InstalledTool`](InstalledTool.md).[`version`](InstalledTool.md#version)
