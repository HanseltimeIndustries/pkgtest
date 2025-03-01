[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / CollectLogFilesOn

# Enumeration: CollectLogFilesOn

Since pkgtest is scanning all stdio from exec processes when collecting log files,
it is important to be able to limit when that scanning and saving happens.

It is generally recommended to use "Error" when collecting log files so that you
can find logs related to failed processes while minimizing the extra computation that
occurs.

## Enumeration Members

### All

> **All**: `"all"`

Stdout and stderr will be scanned and collected regardless of exit code

***

### Error

> **Error**: `"error"`

Only if the exec process that we're monitoring did a non-zero exit
