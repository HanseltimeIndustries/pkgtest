# Dependencies of Test Projects

Since `pkgtest` is a package testing tool, we try to honor dependencies from the package.json of the project that
we are running the tool in.

Because of this, `pkgtest` will construct a test project package.json with:

```js
{
    dependencies: {
        'your package name': '[file|portal]:relativepathtoyour pacakge',
        ...peerDependencies,
        ..."any needed tool dependencies",
        ...additionalDependencies,
    }
}
```

At a minimum, this means that you will always have your package linked to and any of its declared peerDependencies provided.
This enforces the fact that peerDependencies should always be required by the upper project.

## Resolving needed tools

If we consider a test that will run with `tsx`, we can see that we need:

1. typescript
2. tsx
3. @types/node - to support node library imports

To ease the burden of declaring everything in multiple places, if `pkgtest` does not have explicit versions set in its config,
it will look for those versions in your pacakge's dependencies.

The order for resolving any of these tool packages is:

1. explicit config version
2. peerDependency
3. dependency
4. devDependency

Note that peerDependency takes precedence over other explicit values since we expect peerDependency to be an explicit client configuration
minimum.

## Additional Dependencies

You can provide additional dependencies if you want to have additional libraries in your test projects.

!!! warning
    Your additional dependencies can override other derived depenedencies.  In general, they shouldn't override things that have their
    own dedicated version fields like typescript or peerDependencies (which you should just change to support the desired version), but 
    in the even that you have a non-standard use case, you can always use additionalDependencies for that.

