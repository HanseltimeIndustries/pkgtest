# Contributing

There are multiple ways that you can contribute to this project.  In all of them, please
make sure to be respectful of fellow users and developers.

- [Contributing](#contributing)
  - [Submitting an issue](#submitting-an-issue)
  - [Developing a Feature or Fix](#developing-a-feature-or-fix)
    - [Documentation](#documentation)
      - [Extensions](#extensions)
      - [Api Generation](#api-generation)
    - [Opening a PR](#opening-a-pr)
    - [Development setup](#development-setup)
    - [Commit syntax](#commit-syntax)
    - [Development Testing](#development-testing)
      - [Unit tests](#unit-tests)
      - [Linting](#linting)
      - [Typescript \& SWC](#typescript--swc)
      - [Optional - Testing built script locally](#optional---testing-built-script-locally)
      - [Optional - Personal CI checks](#optional---personal-ci-checks)
      - [Optional - Debugging](#optional---debugging)
  
*Table of Contents generated with VSCode Markdown All In One extension*

## Submitting an issue

The simplest way that you can contribute to this project is to submit a issue asking for a
feature or reporting a bug fix.

*TODO: bugfix template*

For bugfixes, please make sure to include any relevant output from the cli or context issues.

For feature requests, a rationale behind need (ideally if you have a real world example) and then
the proposed change in (at least) terms of how the user experience would go.

## Developing a Feature or Fix

### Documentation

This repository uses [MkDocs](https://www.mkdocs.org/) to organize its instructional documentation.  In general, you can simply update
markdown edits for any feature that you're creating and they will be auto-generated into the correct github pages html files.

To get started with mkdocs, you can install the requisite dependencies via `pip3 install -r docs/requirements.txt`.  Then you can
run `mkdocs serve`, which will serve the rendered documentation site on [localhost:8080](localhost:8080).

This repository also uses [typedoc](https://typedoc.org/) to generate more rudimentary api documentation for the programmatic entrypoint
of the library.  That means that we expect appropriate [TsDoc](https://tsdoc.org/) comments on any new classes, interface etc. so that
users can find that information in the `api` section of the mkdocs site.

#### Extensions

This implementation of mkdocs uses the [mkdocs material theme](https://squidfunk.github.io/mkdocs-material/getting-started/).  This
adds a lot of additional features.  Some key features used by this project are [Admonitions](https://squidfunk.github.io/mkdocs-material/reference/admonitions/) and [Content Tabs](https://squidfunk.github.io/mkdocs-material/reference/content-tabs/).   We welcome additional improvements 
to any documentation and visual style via other material features.

Additionally, we use [mike](https://squidfunk.github.io/mkdocs-material/setup/setting-up-versioning/) for maintaining different versions
of documentation.  For the most part, this is something you don't need to worry yourself with, since we only allow our release process to build
the new site versions.  However, if you want to view your documentation with the version drop down, you can run:

```shell
mike deploy "local-version" latest --update-aliases
mike set-default latest
mike serve
```

Unlike with `mkdocs serve`, you will need to call `mike deploy` to synthesize any changes you make, so we recommend just using `mkdocs serve` but this is
added for completeness.

#### Api Generation

`yarn typedoc`

### Opening a PR

When opeing a PR from a fork, please link the issue that you are solving (and if one does not exist, please make one).
Afterwards, please provide a description of the main file changes.

If you would like to contribute a fix or feature proposal, please fork the repo and...

### Development setup

1. Ensure you are on node >=20 and that corepack is enabled: `corepack enable`
2. Explicitly run `yarn install`

### Commit syntax

We make use of the [angular commit syntax](https://www.npmjs.com/package/@commitlint/config-angular) rules for commitlint.

Additionally, our release process uses [semantic-release](https://semantic-release.gitbook.io/semantic-release/), because of this
particular angular commits trigger a release:

| Commit Subject | Version bump | Use for                                                                                   |
|----------------|--------------|-------------------------------------------------------------------------------------------|
| feat           | minor bump   | use for all features that are new compared to previous functionaliy                       |
| fix            | patch bump   | use for all fixes to bugs or if there's a another need for a re-release                   |
| ci             | no bump      | use if just making improvements to ci processes                                           | 
| docs           | no bump      | use if updating documentation (that does not need to be submitted to npm)                 |
| build          | no bump      | if just updating build dependencies, typically for building that don't affect output code |
| test           | no bump      | for updates to just testing related code                                                  |
| * the rest     | no bump      | use as you see fit                                                                        |

### Development Testing

#### Unit tests

We run unit tests through [jest](https://jestjs.io/).  New functionality should be accompanied by new tests for the paths that
this logic creates.

```shell
// Alias for running jest
yarn test

// Example only running the named test file
yarn test import-resources-to-stack 
```

Our unit tests should mock all outbound client libraries and simply focus program logical paths.

#### Linting

We make use of [biome](https://biomejs.dev) to ensure formatting and additional lint rules.

You can run:

```shell
yarn lint --fix
yarn format --fix
```

To automatically change any immediately fixable problems and see the others reported.

Additionally, it is recommended that you integrate biome IDE support for better visibility while writing the code.

#### Typescript & SWC

We use typescript for typechecking and to compile types our projects to .d.ts.
For compilation, we make use of [swc](https://swc.rs/) since it is generally faster and also supports transpiling to full
extensions for projects that are esm (as well as supporting commonjs transpilation more completely).
Additionally, we use rspack for any binary commands that this library might create to bundle in libraries so that they 
are not subject to package version mismatch when running the cli commands.

Please keep in mind that while swc compiles typescript, it does not do strict type-checking and therefore we still need
the regular typescript tool.

Be sure that your builds pass:

```shell
yarn build # this does all the build steps

# More granular steps
yarn build:esm # Transpiling to ESM files
yarn build:cjs # Transpiling to commonjs files
yarn build:bin # Packing of any bin files declared in the package.json
yarn build:types # Emitting type declaration files .d.ts
```

#### Optional - Testing built script locally

If you have made a change to a bin script and would like to test some local calls to the package as an installed package, you can do the following:

```shell
#In a shell that has yarn install
yarn build

# In a shell that is new
cd <out of the folder to avoid package.json reading>
npm install -g <path to project>

<bin script> <args>
```

You can run the install again and again after building.

#### Optional - Personal CI checks

Github allows public repos to run CI/CD for free on github actions.  The [pr-checks.yaml](../.github/workflows/pr-checks.yaml) is set up
to not require any specific secrets.  If you would like to test your PRs before submitting them back to the main repo, it is recommended that:

1. You enable Github Actions
2. You disable the release job (that requires secrets specific to the package)
3. Run your PR against your main or alpha branch

#### Optional - Debugging

One way to debug runs of code in this project is through the VSCode javascript debugger terminal.  The benefit of this debugger approach
is that any javascript process that runs will automatically be run and available to debug.  This means that running the integration test
scripts from that terminal will also hit break points when the cli portion of the application is run.
