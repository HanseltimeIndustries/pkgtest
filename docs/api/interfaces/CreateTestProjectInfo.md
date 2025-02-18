[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / CreateTestProjectInfo

# Interface: CreateTestProjectInfo

A context object for create additional file lambdas

## Properties

### binTests?

> `optional` **binTests**: [`BinTestConfig`](BinTestConfig.md)

***

### fileTests?

> `optional` **fileTests**: [`FileTestConfig`](FileTestConfig.md)

***

### moduleType

> **moduleType**: [`ModuleTypes`](../enumerations/ModuleTypes.md)

***

### packageManager

> **packageManager**: [`PkgManager`](../enumerations/PkgManager.md)

***

### packageManagerAlias

> **packageManagerAlias**: `string`

***

### projectDir

> **projectDir**: `string`

The path of the project under test

***

### testProjectDir

> **testProjectDir**: `string`

The path of the current test project that is being created
