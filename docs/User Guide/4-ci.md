# Using Pkgtest in CI

At some point, you will probably want to run your pkgtest command in your CI pipeline.  Running in a CI pipeline comes
with some additional challenges though (including some tools like `yarn` auto-detecting CI and enforcing lock files).

!!! Note

    pkgtest uses itself to test that it works.  Because of this, you can check pkgtest's test-flow.yaml to see a working
    example of pkgtest in Github Actions.

## Setting up your pkgtest call

pkgtest relies on corepack and NodeJs already being on your machine so that it can download and run scripts.

The general steps in any CI are:

1. install your version of node
2. `npm install -g corepack@latest`
   1. This isn't strictly necessary but pkgtest requires a very [recent version of corepack](./5-corepack.md)
3. If your CI environment locks down its normal temp dir,
   1. `export PKG_TEST_TEMP_DIR=<whatever dir you make that should be "temp">`
   2. In github actions, this can look like: `export PKG_TEST_TEMP_DIR="${RUNNER_TEMP}"`
4. `corepack enable`
5. `<your pkg manager> pkgtest`

## Handling lock files

The preceding setup should create a stable environment for calling pkgtest.  However, you will run into the next issue which is,
some package managers will detect that you are in a CI environment and will fail when we install packages into our new test
projects because there is no existsing lock file.

Depending on your security posture in CI, you might also want a lock file for each test project that is created as well.

### Option 1 - skip it

All of the getting started documentation uses the simplified workflow of creating test projects that will have their lock
files populated by each package manager when they install dependencies.  This does mean that non-fixed versions can be a slight
moving target (i.e. `^1.0.3 => installs 1.0.4 and then 1.0.5 the next time`).  It also means that, on the machine that you are running
pkgtest, you could run into any of the security concerns that lockfiles seek to solve.

If you are fine with installing just like you have already been doing in CI, you can set:

```javascript
{
    locks: false
}
```

This will automatically adjust install scripts in each test project to no care about lockfiles, regardless of environment.

### Option 2 - lock file generation

If you do want lock files to be used when installing your packages into test projects, you will need to generate your lock files on your local
machine, and commit them so that pkgtest can install those lockfiles into test projects when running in CI environments.

!!! Tip

    This pattern is effectively the same as snapshot testing patterns.

#### Configuring lockfiles

You can either set `locks: true` or configure where it stores lock files to skip the defaults.  In this case, we have explicitly said to
store locks files within the `<rootDir>/lockfiles` folder.

```javascript
{
    locks: {
        folder: './lockfiles'
    }
}
```

!!! Note

    pkgtest will automatically ignore anything in the lockfiles folder

#### Generating lockfiles

With an enabled `locks configuration`, if you have never generated a lock file yet, pkgtest will try to 
[detect if you are in a ci environment](https://github.com/watson/is-ci) and will go ahead and copy the generated lock files
from a successful test project creation into the specified folder.  It is expected that you commmit that folder as well.

If you have already created lockfiles that were copied to the corresponding folder, you will have to specifically call:

```shell
pkgtest --update-lockfiles
```

Without that option, if you add new dependencies to the project, pkgtest will fail on install because it will run install with the
equivalent of `--frozen-lockfile`.