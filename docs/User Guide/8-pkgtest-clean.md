# pkgtest-clean

As discussed in [getting started](../1-getting-started.md) and in [design](./99-design.md#test-projects), pkgtest
is effectively creating many local test projects and performing an install in each of them before then running
tests.

In pkgtest's normal flow, we delete all test project folders that we created before exiting.  However, you can 
specify either `--preserve` or `--ipreserve` to save some of those test folders (which is particularly useful
for debugging when a certain project configuration fails).  Additionally, if your machine was to crash or you were
to kill your pkgtest process without allowing for our SIGINT handlers to run, you might have left over projects.

There is a very real chance then, that you can end up having disk space taken up from forgotten about temporary test projects.

To help with this, we provide a utility command:

```
=== "yarn"
    ```shell
    yarn pkgtest-clean
    ```
=== "npm"
    ```shell
    npx pkgtest-clean
    ```
=== "pnpm"
    ```shell
    pnpm pkgtest-clean
```

The above command will list any files that match the expected pkgtest prefix for test project folders in the temporary directory,
list them to you, and then, if confirmed, will delete those folders.

## flags

!!! Note

    Make sure to run `--help` to see the most up to date flags available

### -y, --yes

Since this is a destructive operation, we require a manual confirmation before deleting.  However, if you wanted to automate this process,
you can supply this flag to automatically answer yes to that prompt.

### --check

This will only print any matching folders that it finds and will exit with a non-zero if there are matches.

### -f, --force

This will attempt to delete the folders using `rm -rf` instead of just `rm -r`.