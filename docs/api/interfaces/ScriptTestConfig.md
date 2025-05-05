[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / ScriptTestConfig

# Interface: ScriptTestConfig

A Script test involves declaring a set of scripts that will be run in the testProject and evaluated to see if they're true

They will ultimately be run by <package manager> <script>

## Properties

### exitCode?

> `optional` **exitCode**: `number`

The expected exit code this script should yield
(defaults to 0)

***

### name

> **name**: `string`

***

### script

> **script**: `string`

***

### stderrMatch?

> `optional` **stderrMatch**: `string` \| (`stderr`) => `boolean`

If supplied, this will check to see if the stderr of the script matches the provided
Regex string or lambda and will only pass if it returns true

WARNING - Does not work on Windows. It eats output from stdout and stderr on npm and pnpm run

***

### stdoutMatch?

> `optional` **stdoutMatch**: `string` \| (`stdout`) => `boolean`

If supplied, this will check to see if the stdout of the script matches the provided
Regex string or lambda and will only pass if it returns true

WARNING - Does not work on Windows. It eats output from stdout and stderr on npm and pnpm run
