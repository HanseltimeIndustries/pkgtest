# Parallelism

By default, pkgtest runs its tests and test suites synchronously.  If you find that your pkgtest tests are running too slowly,
there is a `-p, --parallel` option that you can invoke on the command line to enable parallelism at the test suite level.


!!! Note

    The only parallelism that exists in pkgtest is when setting up test projects (during the installation phase), and then by
    which test suites run. Tests in a suite are always run in series.

## Tuning parallelism

Since pkgtest is effectively running shell calls to scripts in test projects, it is already using multiple threads to execute (basically 2, since the node process awaits the shell process by default).  In a simplified case, if you had a single threaded library that you were testing and `-p 4`, then you could expect 5 parallel processes on your machine.  If your library or bin script has parallelism (maybe it spawns multiple
shells or workers in parallel), then you might start hitting the resource limits of your machine despited a relatively low number.

As a real work example, the pkgtests that this repo has do A LOT of heavy lifting (they run pkgtest again in the test projects which entails additional test projects being created and network loading of packages, etc.).  We found that, for our simple test entry, parallelism could be very high, but for the `bin` tests where we do a multiple new projects, `p < 4` led to us not missing test times (and test times increasing due
to parallelism can generally be attributed to system resources being over-leveraged).
