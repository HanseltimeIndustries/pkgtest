[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / PkgManagerOptionsConfig

# Interface: PkgManagerOptionsConfig\<T\>

More complex package manager configuration where supported properties per package
manager are available to create variants of a singular package manager based project
(like yarn has plug'n'play, node_modules, and pnpm linker functions)

## Type Parameters

• **T** *extends* [`PkgManager`](../enumerations/PkgManager.md)

## Properties

### alias

> **alias**: `string`

For test suite identification, this will provide an alias for the configuration in the event that
multiple of the same package manager are used

***

### options?

> `optional` **options**: [`PkgManagerOptions`](../type-aliases/PkgManagerOptions.md)\<`T`\>

***

### packageManager

> **packageManager**: `T`

***

### version?

> `optional` **version**: `string`

The version of the package manager to use (installed via corepack)

Defaults to latest if not supplied
