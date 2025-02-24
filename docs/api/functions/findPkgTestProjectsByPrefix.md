[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / findPkgTestProjectsByPrefix

# Function: findPkgTestProjectsByPrefix()

> **findPkgTestProjectsByPrefix**(`tempDir`): `string`[]

This will return any pkgtest projects in the current temp directory provided

This is meant to be used for auditing projects that were left over either from force
killing a pkgtest run before it could clean up resources or from use of --preserve

## Parameters

### tempDir

`string`

The directory that pkgtest would've been using as a temp directory

## Returns

`string`[]
