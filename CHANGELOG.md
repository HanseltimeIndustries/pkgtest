# [1.3.0](https://github.com/HanseltimeIndustries/pkgtest/compare/v1.2.0...v1.3.0) (2025-03-01)


### Bug Fixes

* add log insufficient corepack version ([f25a0c6](https://github.com/HanseltimeIndustries/pkgtest/commit/f25a0c61304466fac0d3bf2c45c6e523833742ee))
* adding onWindowProblems skip action ([c7efbc3](https://github.com/HanseltimeIndustries/pkgtest/commit/c7efbc3789a29c433dc14918f2cd12e66b744ac7))
* amending onWindowsProblems during tests ([b37da8f](https://github.com/HanseltimeIndustries/pkgtest/commit/b37da8ffbf058788361b5378039db5b24e237652))
* config cli argument ([2053434](https://github.com/HanseltimeIndustries/pkgtest/commit/205343429747cd850e2dd95c36a723ba6030fefc))
* enable windows file loading ([359dc5a](https://github.com/HanseltimeIndustries/pkgtest/commit/359dc5a8df9461d259450263df55bfa4542f63a8))
* install empty lock files on no lock ([72f3173](https://github.com/HanseltimeIndustries/pkgtest/commit/72f317302f8bf2c1a47ef47f0dbbcb2de22cc80f))
* resolve lockfile for npm on windows ([2c854a8](https://github.com/HanseltimeIndustries/pkgtest/commit/2c854a80bcdf02f72d6c5473cc6fcbf84c9c9b2c))
* switch to npm -c to avoid node downloads ([e0f56af](https://github.com/HanseltimeIndustries/pkgtest/commit/e0f56afc21e93b4b0bde515095d43123fadea6e1))
* sync install yarn-berry on windows ([7ffaeaa](https://github.com/HanseltimeIndustries/pkgtest/commit/7ffaeaa2c542bec03f87b7654ef8c8f86e929c6e))
* use npx -c to avoid windows path issues ([be49337](https://github.com/HanseltimeIndustries/pkgtest/commit/be49337398c5dec20c026c1ab2866d0b03beb4eb))


### Features

* adding setup log file collection ([6302c7b](https://github.com/HanseltimeIndustries/pkgtest/commit/6302c7b3fb4e632820e4fe0cf3c0aa540c34f5f0))
* allowing log file collection in stages ([43586cd](https://github.com/HanseltimeIndustries/pkgtest/commit/43586cdb4742ec57cee41d0bb3c8e3830b11aabc))

# [1.2.0](https://github.com/HanseltimeIndustries/pkgtest/compare/v1.1.0...v1.2.0) (2025-02-24)


### Bug Fixes

* correct esm path and ts peer dependencies ([af23e4f](https://github.com/HanseltimeIndustries/pkgtest/commit/af23e4f1cb8a985bef60b0f1fe0a16ee62953c73))
* esm + yarn-barry + ts-node resolution ([7b20130](https://github.com/HanseltimeIndustries/pkgtest/commit/7b20130414a95d339d0a0ad26baa6be39faa1395))


### Features

* adding pkgtest-clean utility command ([dbe3d5d](https://github.com/HanseltimeIndustries/pkgtest/commit/dbe3d5d88dc9146b2b34b8db14d9cc5b10b719d9))
* adding script tests functionality ([bf0da16](https://github.com/HanseltimeIndustries/pkgtest/commit/bf0da160542d92be2cd04c85d3c2f6c8b4a1b0e4))

# [1.1.0](https://github.com/HanseltimeIndustries/pkgtest/compare/v1.0.0...v1.1.0) (2025-02-22)


### Bug Fixes

* add preinstall behavior for latest version ([9368f1b](https://github.com/HanseltimeIndustries/pkgtest/commit/9368f1b3a234f0cc41a08ebcaa2214f2035b5951))
* move cache cleaning either normal or sigint close out ([eb312a4](https://github.com/HanseltimeIndustries/pkgtest/commit/eb312a4e9f23694cb79005a37ed8c43e2a763c5c))
* preserve the no yarnv1 cache clean option ([7f254f1](https://github.com/HanseltimeIndustries/pkgtest/commit/7f254f11da513802ca3c953846a9d78c369e12df))


### Features

* adding an interactive preserve option ([309708a](https://github.com/HanseltimeIndustries/pkgtest/commit/309708a11f7a15f2ead033589aaa05267a52ecd2))

# 1.0.0 (2025-02-20)


### Bug Fixes

* add an optoin to skip yarnv1 cache clean up ([706e2c2](https://github.com/HanseltimeIndustries/pkgtest/commit/706e2c2036f37557da090e5f08011dca536212fa))
* decouple filter an check from test creation ([4b0ab68](https://github.com/HanseltimeIndustries/pkgtest/commit/4b0ab68188c4dabaf24a80d20ccafbee665eaaae))
* deserialize version for typescript ([dac1fca](https://github.com/HanseltimeIndustries/pkgtest/commit/dac1fca0cb3d94e65492fe224bf2f92091a98106))
* exec errors being swallowed ([721bdf9](https://github.com/HanseltimeIndustries/pkgtest/commit/721bdf94b2cdfa0082885d1b85d56022c501d939))
* handle plug'n'play pollution ([0eabda3](https://github.com/HanseltimeIndustries/pkgtest/commit/0eabda38bdefb17bf13928f7623a332ac9394289))
* handling multiple parally yarn-v1 cache collisions ([b48fc08](https://github.com/HanseltimeIndustries/pkgtest/commit/b48fc08715c6e5f000accd2c22ddaeca842a1a2b))
* hoist package manager version field ([3b4062a](https://github.com/HanseltimeIndustries/pkgtest/commit/3b4062ada50e650b7b519ed4beaac01ecdbc40fc))
* make config do standardization ([871e131](https://github.com/HanseltimeIndustries/pkgtest/commit/871e131567ca8979d98cea7e56b5119a6fce7aca))
* non-zero exit code on test failures ([da8dbc6](https://github.com/HanseltimeIndustries/pkgtest/commit/da8dbc6e33e53e98d5dbf1f25d8c26c4ec513e69))
* parse timeout ([89a95e1](https://github.com/HanseltimeIndustries/pkgtest/commit/89a95e1190dfcba6db2aa19112cf9e50bbddad90))
* refactoring to sort bin cmd tests ([491e863](https://github.com/HanseltimeIndustries/pkgtest/commit/491e8639658fd8d4de4d3b1e3fcdd1583184b7e5))
* renaming RunBy to RunWith ([f1b2ef9](https://github.com/HanseltimeIndustries/pkgtest/commit/f1b2ef92e7bab06caf8bcde5e9f1d6e606735932))
* serialize yarn-v1 installs ([172df7a](https://github.com/HanseltimeIndustries/pkgtest/commit/172df7a610172c2b124fc5ff99380a1c9b10862a))
* switch to yarn berry naming ([daa984f](https://github.com/HanseltimeIndustries/pkgtest/commit/daa984f982bca9c0a7e2b440683c9fa7555034c1))
* switching cleanup to on process events ([aa175d3](https://github.com/HanseltimeIndustries/pkgtest/commit/aa175d3ecd1cfaef485cfe4097e670c49e5a8748))
* testing bin files and updating rspack ([8077e02](https://github.com/HanseltimeIndustries/pkgtest/commit/8077e025c222b74cadc7ce52c215f52180aa714b))
* testMatch on cwd relative patterns ([fd3eb3d](https://github.com/HanseltimeIndustries/pkgtest/commit/fd3eb3dfc8b1d504518ccfec00bebdc3017cfb94))
* time reporting ([cec2437](https://github.com/HanseltimeIndustries/pkgtest/commit/cec24371f26a637428aea1ecce3a046bf4588cd1))


### Features

* add ability to filter on test types ([ab84038](https://github.com/HanseltimeIndustries/pkgtest/commit/ab84038e7cb3a3a13d3d6a878df8bfad6b596e0e))
* add suite summaries at the end of output ([f554891](https://github.com/HanseltimeIndustries/pkgtest/commit/f554891ba7e30dbcf344305fe68f588c5f316dd9))
* adding additionalFiles options ([1191f2c](https://github.com/HanseltimeIndustries/pkgtest/commit/1191f2c8e9ff93e1b481cc655e8d53c97146ffc9))
* adding aliases for pkg manager configs ([1706b57](https://github.com/HanseltimeIndustries/pkgtest/commit/1706b579b87592e08a3745522aecdfbc5b9aac3e))
* adding installOnly option ([31e1ce7](https://github.com/HanseltimeIndustries/pkgtest/commit/31e1ce7f9acd588dfb0f84bdd21f56891c075df1))
* adding matchRoot and matchIgnore options ([8cf9bcf](https://github.com/HanseltimeIndustries/pkgtest/commit/8cf9bcf3597a9143656d1131f182cc80223fa9a9))
* adding no filters ([368e3dd](https://github.com/HanseltimeIndustries/pkgtest/commit/368e3dd2452d678583499651bafbd5f584755d96))
* adding parallelism ([deb1def](https://github.com/HanseltimeIndustries/pkgtest/commit/deb1defc938133873da96758d626d61fd9c692d4))
* adding pnpm support ([a071b83](https://github.com/HanseltimeIndustries/pkgtest/commit/a071b83b770e66500bcdd0bc9234a1927bf8b474))
* adding test run filter pattern ([1b8b155](https://github.com/HanseltimeIndustries/pkgtest/commit/1b8b15510f9f73435130072f6c70a948d0a32478))
* adds initial bin test functionality ([e483c04](https://github.com/HanseltimeIndustries/pkgtest/commit/e483c047297ddfa73c3aa750af77b3f0c7a3058b))
* allow packagejson overriding ([223de50](https://github.com/HanseltimeIndustries/pkgtest/commit/223de5083316ebaaf77ac50219abbf7c31c28291))
* clean yarn-v1 cache on exit ([93c104a](https://github.com/HanseltimeIndustries/pkgtest/commit/93c104ad61b37f1f61bc910aa4d36b1df72ba684))
* ensure minimum corepack ([c1e73ba](https://github.com/HanseltimeIndustries/pkgtest/commit/c1e73ba9f98bef35dc9f0443b32a03b6dd997781))
* initial bin call functions and testing ([a5bd774](https://github.com/HanseltimeIndustries/pkgtest/commit/a5bd774e6943e6c6864b58559f3c10930b3a0037))
* initial program ([ff85949](https://github.com/HanseltimeIndustries/pkgtest/commit/ff8594932076e24aa47481760d100e6b46da3794))
* lock functionality ([d223f80](https://github.com/HanseltimeIndustries/pkgtest/commit/d223f80524c98eb6183561043760d8216ab3386f))
* rename matchRootDir to rootDir ([dd91bae](https://github.com/HanseltimeIndustries/pkgtest/commit/dd91bae6342c9b0d8f7b9e0ba78a6952fddfe8f6))
* resource clean up ([e20029b](https://github.com/HanseltimeIndustries/pkgtest/commit/e20029b46a857f11e3c6776d90bee7c9fe4a2f4a))
* supporting additionalDependencies ([472c48b](https://github.com/HanseltimeIndustries/pkgtest/commit/472c48b9a230b9f471ac7b16b643bd5c5d77f394))
* supporting ts-node in esm modules ([ae3ac75](https://github.com/HanseltimeIndustries/pkgtest/commit/ae3ac7551fb81f6f6efee298009f4d5b15347070))
* switch to per entry timeouts ([769462b](https://github.com/HanseltimeIndustries/pkgtest/commit/769462b24ba5274efa0785958dd4207ca2dd332a))
* switching config to use fileTests ([5b6ddab](https://github.com/HanseltimeIndustries/pkgtest/commit/5b6ddabd476d57e5a87e2ba165cc745b122ff8b4))
* updating to better APIs as a result of testing ([196e714](https://github.com/HanseltimeIndustries/pkgtest/commit/196e7143551572c58cdbfb5df0199c0e0df18ae5))
