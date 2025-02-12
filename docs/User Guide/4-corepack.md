# Corepack

To keep track of which package managers are running which projects, pkgtest uses (corepack)[https://www.npmjs.com/package/corepack].

Corepack has historically been bundled with NodeJS, but is not guaranteed to always be bundled with NodeJS.  Additionally, there
are some issues with expired package keys when corepack is downloading package managers.

This recently happened with `pnpm > 9.x` and `corpack < 0.30`.  The error looked like:

```shell
Error: Cannot find matching keyid: {"signatures": ....
```

Pkgtest tries its best to ensure that you don't end up troubleshooting these errors by throw an error if the corepack version is below
the non-problematic version that it uses to run its own tests.  However, as new package managers come out, you may need to configure your
corepack globally before running package test.

## CI configuration

Using Github Actions as an example, your set up for running pkgtest should look something like:

```yaml
      - name: corepack
        run: |
          corepack enable
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'yarn'
          cache-dependency-path: yarn.lock
      - name: update corepack
        run: |
          npm install -g corepack@latest
```
