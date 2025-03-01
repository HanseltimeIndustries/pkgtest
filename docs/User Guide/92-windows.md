# Windows support

pkgtest's intention is to provide a way for you to verify that your package works in as many environments
as possible.  Unfortunately, the amount of problems on windows, makes it hard to reliably solve pkgtest's
functionality in all scenarios.

This document serves to provide configurations that work on windows.  If you would like to dedicate time
to setting up pkgtest on windows with more configurations, please feel free to contribued PRs.

## --onWindowsProblems <skip|error>

The below discussions about Windows problems can be avoided by using this flag when running pkgtest.  In that case,
pkgtest will either make a note that it is skipping a set of test suites because configuring their package managers is known to
be problematic or it will throw an error to avoid having a problematic configuration.

We recommend using a `skip` setting in CI so that you can run more pkg managers in the event that a newer version of pkgtest
solves one of the problems.

## Windows and package manager problems

### Yarn v1

Despite many projects still using yarn-v1, there is a known bug with [local package imports in yarn-v1](https://github.com/yarnpkg/yarn/issues/990) and windows resolution.  Basically, yarn-v1 will work, but it will be excruciatingly slow on install in test projects (think 5-10 minutes).
Additionally, since yarn-v1 is no longer being developed, this will not change.

### Yarn berry (plug'n'play)

This only happens on Node 18.

It has been my experience that yarn berry with `tsx` and `ts-node` runs into a problem where the respective 
node loaders can't resolve. This is not the case if you run yarn berry with node-modules resolution so it clearly points to some issue
where node is not resolving through the `plug'n'play` loader.   The only way I have been able to get this to work is by switching to a
newer version of node.