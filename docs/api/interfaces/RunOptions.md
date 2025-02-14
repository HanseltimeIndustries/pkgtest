[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / RunOptions

# Interface: RunOptions

## Properties

### configPath?

> `optional` **configPath**: `string`

The path of the config file to use - if not supplied obeys default search rules

***

### debug?

> `optional` **debug**: `boolean`

If set to true, this provides additional levels of logging (i.e. the stdout of each test)

***

### failFast?

> `optional` **failFast**: `boolean`

Immediately stop running tests after a failure

***

### filters?

> `optional` **filters**: `object`

For every supplied filter, the tests that would be created via the configs will be paired down to only thouse
that match all filters provided

#### binTestNames?

> `optional` **binTestNames**: `string`[]

A string match/regex filter to only run bins that match

#### fileTestNames?

> `optional` **fileTestNames**: `string`[]

A glob filter of file names to run (relative to the cwd root)

#### moduleTypes?

> `optional` **moduleTypes**: [`ModuleTypes`](../enumerations/ModuleTypes.md)[]

#### packageManagers?

> `optional` **packageManagers**: [`PkgManager`](../enumerations/PkgManager.md)[]

#### pkgManagerAlias?

> `optional` **pkgManagerAlias**: `string`[]

#### runWith?

> `optional` **runWith**: [`RunWith`](../enumerations/RunWith.md)[]

#### testTypes?

> `optional` **testTypes**: [`TestType`](../enumerations/TestType.md)[]

***

### preserveResources?

> `optional` **preserveResources**: `boolean`

If set to true, this will not clean up the test project directories that were created

Important! Only use this for debugging pkgtests or in containers that will have their volumes cleaned up
directly after running in a short lived environment.  This will populate your temporary directory with
large amounts of node modules, etc.

***

### timeout?

> `optional` **timeout**: `number`

The max amount of time for a test to run (keep in mind, this is just the call to running the pkgTest script
and not installation)

Defaults to 2000
