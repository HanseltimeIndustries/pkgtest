[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / OnWindowsProblemsAction

# Enumeration: OnWindowsProblemsAction

Since windows has some historical installation problems with local packages,
this says what to do if the platform is windows and we encounter a test project
that would be problematic.

## Enumeration Members

### Error

> **Error**: `"error"`

This will throw an error to let you know that this test would be run and is problematic.
This is good if you want to keep a dynamic pkgtest.config.js file where you actively
don't provide configurations for problematic tests.

***

### Skip

> **Skip**: `"skip"`

This will just leave a notice in the stdout and skip the test as if it was filtered
