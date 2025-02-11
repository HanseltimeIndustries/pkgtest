[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / YarnV4Options

# Interface: YarnV4Options

## Extends

- [`PkgManagerBaseOptions`](PkgManagerBaseOptions.md)

## Properties

### installCliArgs?

> `optional` **installCliArgs**: `string`

The cli arguments to add to the install command

#### Inherited from

[`PkgManagerBaseOptions`](PkgManagerBaseOptions.md).[`installCliArgs`](PkgManagerBaseOptions.md#installcliargs)

***

### yarnrc?

> `optional` **yarnrc**: `any`

If provided, any .yarnrc.yml properties that you would like to specify

https://yarnpkg.com/configuration/yarnrc

The most common of these would be nodeLinker so you can verify non-plug'n'play functionality
