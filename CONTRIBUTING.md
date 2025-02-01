# Contributing

There are multiple ways that you can contribute to this project.  In all of them, please
make sure to be respectful of fellow users and developers.

- [Contributing](#contributing)
  - [Submitting an issue](#submitting-an-issue)
  - [Developing a Feature or Fix](#developing-a-feature-or-fix)
    - [Opening a PR](#opening-a-pr)
    - [Development setup](#development-setup)
    - [Commit syntax](#commit-syntax)
    - [Development Testing](#development-testing)
      - [Unit tests](#unit-tests)
      - [Linting](#linting)
      - [Typescript](#typescript)
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

```
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

#### Typescript

We use typescript to compile our projects to .js.  Be sure that your builds pass when you run `yarn build` and your `dist` and `dist-bin` folder 
is populated.

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

Github allows public repos to run CI/CD for free on github actions.  The [pr-checks.yaml](./.github/workflows/pr-checks.yaml) is set up
to not require any specific secrets.  If you would like to test your PRs before submitting them back to the main repo, it is recommended that:

1. You enable the Github Actions
2. You disable the release job (that requires secrets specific to the package)
3. Run your PR against your main or alpha branch

#### Optional - Debugging

One way to debug runs of code in this project is through the VSCode javascript debugger terminal.  The benefit of this debugger approach
is that any javascript process that runs will automatically be run and available to debug.  This means that running the integration test
scripts from that terminal will also hit break points when the cli portion of the application is run.
