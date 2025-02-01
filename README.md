# test-yarn


# Common and ESM testing pattern

I want to create a single file:

```
// 
import { myFunc } from 'my-func';

myFunc()
```

This is an "import test" that we want to:

1. Transform to commonjs and esm syntax
2. create some project and import our built binary

Steps (MVP):

1. For [commonjs|esm]
2. Create temporary project
3. For [package manager], install packages
4. Call node endpoint

```typescript
{
    tests: "test-cjs-esm/*.pkgtest.ts",
    runFor: [
        {
            module: 'commonjs',
            testPath: 'folder/*.pkgtest.ts'
            prepare: {
                typescript: {
                    version: string,
                    config: {
                        // Config overrides
                    }
                }
            }
        }
    ]
    cjsTest: {
        match?: string,
        typescript: {
            // tsconfig override
        }
    },
    esmTest: {
        match?: string,
        typescript: {
            // tsconfig override
        }
    }
}
```

```typescript
import { fn } from '@my-scope/my-package'

const val = fn()

assert(val === 'something', 'This works just fine!')
```

```javascript
const { fn } = require('@my-scope/my-packaeg')

const val = fn()

assert(val === 'something', 'This works just fine!')

```



