[**@hanseltime/pkgtest**](../README.md)

***

[@hanseltime/pkgtest](../README.md) / FailFastError

# Class: FailFastError

## Extends

- `Error`

## Constructors

### new FailFastError()

> **new FailFastError**(`message`?): [`FailFastError`](FailFastError.md)

#### Parameters

##### message?

`string`

#### Returns

[`FailFastError`](FailFastError.md)

#### Inherited from

`Error.constructor`

### new FailFastError()

> **new FailFastError**(`message`?, `options`?): [`FailFastError`](FailFastError.md)

#### Parameters

##### message?

`string`

##### options?

`ErrorOptions`

#### Returns

[`FailFastError`](FailFastError.md)

#### Inherited from

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

#### Inherited from

`Error.cause`

***

### message

> **message**: `string`

#### Inherited from

`Error.message`

***

### name

> **name**: `string`

#### Inherited from

`Error.name`

***

### stack?

> `optional` **stack**: `string`

#### Inherited from

`Error.stack`

***

### prepareStackTrace()?

> `static` `optional` **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Optional override for formatting stack traces

#### Parameters

##### err

`Error`

##### stackTraces

`CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

`Error.prepareStackTrace`

***

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

#### Inherited from

`Error.stackTraceLimit`

## Methods

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt`?): `void`

Create .stack property on a target object

#### Parameters

##### targetObject

`object`

##### constructorOpt?

`Function`

#### Returns

`void`

#### Inherited from

`Error.captureStackTrace`
