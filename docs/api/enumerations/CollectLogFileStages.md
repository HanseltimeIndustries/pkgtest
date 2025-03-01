[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / CollectLogFileStages

# Enumeration: CollectLogFileStages

Different stages that we can isolate and scan for log collection

This is important because finding log files involves pkgtest scanning
all stdio of every exec command that runs and using a regex to find log files.

Then at the end of that scan, it will copy those log files over to the log collection
folder.  This is valuable for ephemeral systems that you can't exec into but will slow
down anything that does not need it.

## Enumeration Members

### All

> **All**: `"all"`

All stages - this will take precedence over any other stages

***

### BinTests

> **BinTests**: `"bin"`

Just bin tests

***

### FileTests

> **FileTests**: `"file"`

Just file tests

***

### None

> **None**: `"none"`

***

### ScriptTests

> **ScriptTests**: `"script"`

Just script tests

***

### Setup

> **Setup**: `"setup"`

All setup exec calls from corepack installation to pkgmanager installation

***

### Tests

> **Tests**: `"tests"`

All test runs will be scanned

Note: this takes precednece over file tests if both specified
