/**
 * The type of module that the testing package that is created will be listed as:
 * 
 * i.e. "type": "module" for esm
 */
export enum ModuleTypes {
    Commonjs = 'commonjs',
    ESM = 'esm'
}

/**
 * The different ways that we run the test files
 */
export enum RunBy {
    /**
     * This only works with .js files or files that are transformed to a js file first
     */
    Node = 'node',
    /**
     * This will run ts-node <script>.ts
     */
    TsNode = 'ts-node',
    /**
     * This will run via tsx <script>.ts
     */
    Tsx = 'tsx'
}

export enum PkgManager {
    Npm = 'npm',
    Pnpm = 'pnpm',
    YarnV1 = 'yarn-v1',
    YarnV4 = 'yarn-v4',
}

export enum YarnMode {
    Pnpm = 'pnpm',
    NodeModules = 'node_modules',
    pnp = 'pnp',
}

export interface InstalledTool {
    /**
     * Explicit version to test.  If not supplied, we will use the
     * dependency/devDependency of the testing project or throw an error if we can't find anything
     */
    version?: string
}

export interface TsNodeRun extends InstalledTool {}

export interface TsxRun extends InstalledTool {}

export interface TypescriptOptions extends InstalledTool {
    /**
     * Typescript configuration that is merged with the base typescript that is created
     */
    config: any
    /**
     * The version of the @types/node
     */
    nodeTypes?: InstalledTool
    /**
     * Required if Tsx is included in the runBy section
     */
    tsx?: TsxRun
    /**
     * Required if ts-node is included in the runBy section
     */
    tsNode?: TsNodeRun 
}


interface TestFor {
    moduleType: 'commonjs' | 'esm',
    /**
     * A glob pattern for where to find tests
     */
    testPath: string,
    /**
     * If you are not writing the test files in the exact same module format that you want,
     * this is where you provide preparation 
     */
    prepare?: {
        /**
         * The package manager to use when installing and calling scripts for this test
         */
        pkgManager: PkgManager,
        /**
         * If yarn berry is being used, you can specify the nodeLinker mode
         */
        yarnMode?: YarnMode

        typescript?: {
            /**
             * The version of typescript to use when transpiling
             */
            version: string
            /**
             * Any tsconfig options that you would like applied
             */
            config: any
        }
    }
    /**
     * For each test file found, how do we run it
     */
    runBy: RunBy
}
