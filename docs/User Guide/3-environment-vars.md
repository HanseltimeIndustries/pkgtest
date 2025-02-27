# Environment Variables

While most of the configuration of pkgtest is done through the [configuration file](./2-configuration.md),
there are a few less common functionalities that can be configured via environment variables.

!!! Note

   These apply for both `pkgtest` and `pkgtest-clean`.

## PKG_TEST_TEMP_DIR

By default, pkgtest will use `import { tmpdir } from 'os';` to find a folder where it can set up test projects.
However, if you would like to change that location (or tmpdir is not writable on your system - like CI runners),
you can explicitly set a folder for pkgtest to write test projects into

## PKG_TEST_TEMP_DIR_PREFIX

By default pkgtest will generate a randomly postfixed folder in the temp directory of the form: `pkgtest-XXXXXXX`.

You can change the prefix by setting this environment variable before running your pkgtest commands.

```shell
# This will create folders named customPrefix-XXXXXXXX
PKG_TEST_TEMP_DIR_PREFIX="customPrefix-" yarn pkgtest

# This will look for cleaning customPrefix- folders
 PKG_TEST_TEMP_DIR_PREFIX="customPrefix-" yarn pkgtest-clean
```

## PKG_TEST_LOG_COLLECT_DIR

This will change the location that pkgtest collects all log files that it can find to when there is an error.  This will only
have an affect if the `--collectLogs` flag was enabled and is really only meant for CI processes where you can't interactively
go to the package and re-run a command.

pkgtest will collect its logs within a timestamped folder (in case you are trying to use this with multiple runs of pkgtest in
a row).

By default, this will be `tmpdir()/pkgtest-logs`