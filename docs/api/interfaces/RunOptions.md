[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / RunOptions

# Interface: RunOptions

## Properties

### collectLogFilesOn?

> `optional` **collectLogFilesOn**: [`CollectLogFilesOn`](../enumerations/CollectLogFilesOn.md)

If set, pkgtest will scan logs during setup calls for any detected log files and then copy them to the
log collection folder on the system when:

- Error - only an error triggers a failure of an exec
- All - any time we see a log file mentioned regardless of failure

Note: this is mainly meant for CI processes

***

### collectLogFilesStages?

> `optional` **collectLogFilesStages**: [`CollectLogFileStages`](../enumerations/CollectLogFileStages.md)[]

***

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

> `optional` **filters**: `EntryFilterOptions` & `object`

For every supplied filter, the tests that would be created via the configs will be paired down to only thouse
that match all filters provided

#### Type declaration

##### binTestNames?

> `optional` **binTestNames**: `string`[]

A string match/regex filter to only run bins that match

##### fileTestNames?

> `optional` **fileTestNames**: `string`[]

A glob filter of file names to run (relative to the cwd root)

***

### installOnly?

> `optional` **installOnly**: `boolean`

This means we will create the test projects and then end.  This is helpful for 2 scenarios:

1. If you just want to have a test project created and then access it afterwards to test config with "--preserve"
2. If you want to pre-cache dependencies before running tests separately

***

### iPreserveResources?

> `optional` **iPreserveResources**: [`IPreserveResourcesFn`](../type-aliases/IPreserveResourcesFn.md)

Interactive Preserve resources -

***

### isCI

> **isCI**: `boolean`

If true, we've detected a ci environment - used for some determinations around yarn install

***

### noYarnv1CacheClean?

> `optional` **noYarnv1CacheClean**: `boolean`

Yarn v1 will aggresively expand its local cache when doing the import of the packages.  As a result,
we make sure to run a yarn cache clean <our package under test> before finishing the program.  You can turn
this off if you are running in an ephemeral environment and would like to save some time.

***

### parallel

> **parallel**: `number`

The number of test suites to run in parallel

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

***

### updateLocks?

> `optional` **updateLocks**: `boolean`

If set to true, and locks: false is not set in the config, this will update any changes to the lock files in test
projects to the lockfiles folder
