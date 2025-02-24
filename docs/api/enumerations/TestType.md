[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / TestType

# Enumeration: TestType

## Enumeration Members

### Bin

> **Bin**: `"bin"`

Represents a test where we are actually going to call one of the declared bin's in the package
that we're testing

***

### File

> **File**: `"file"`

Represents a test that we are going to call node or some node equivalent on a source file

***

### Script

> **Script**: `"script"`

Represents a test where we call a script that we inserted into each test project's package.json.
This is ideal for plugin type packages:

i.e. writing a jest matcher and then running your pkgtest to call "jestTest": "jest" with an appropriate
config file that has tests that use the matcher.
