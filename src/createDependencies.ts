import { tryGetDependency } from "./tryGetDependency"
import { TypescriptOptions, RunBy, PkgManager } from "./types"

/**
 * Creates a set of dependencies for the target test project that given the package
 * json of the project we want to test, it's relative url to the target package.json we 
 * are building dependencies for and test options.
 *
 * @param packageJson 
 * @param packageRelativePath 
 * @param options 
 * @returns 
 */
export function createDependencies(packageJson: {
    name: string
    dependencies?: {
        [pkg: string]: string
    }
    devDependencies?: {
        [pkg: string]: string
    }
    peerDependencies?: {
        [pkg: string]: string
    }
}, packageRelativePath: string, options: {
    typescript?: TypescriptOptions,
    runBy: RunBy[]
    pkgManager: PkgManager
}) {
    const {
        name,
        peerDependencies,
    } = packageJson

    const {
        typescript,
        runBy,
        pkgManager,
    } = options

    // Specific templates have their own dependencies
    const specificDeps = {
        typescript: typescript?.version ?? tryGetDependency('typescript', packageJson),
        '@types/nodes': typescript?.nodeTypes ?? tryGetDependency('@types/node', packageJson)
    }
    // Make sure we have minimum dependency requirements
    runBy.forEach((rBy) => {
        if (rBy === RunBy.Tsx || rBy === RunBy.TsNode) {
            if (!specificDeps.typescript) {
                throw new Error(`Cannot run by ${rBy} without a typescript version supplied or discoverable in package.json!`)
            }
            if (!specificDeps.typescript) {
                throw new Error(`Cannot run by ${rBy} without a typescript version supplied or discoverable in package.json!`)
            }
        }
    })

    runBy.forEach((rBy) => {
        switch(rBy) {
            case RunBy.Node:
            break;
            case RunBy.TsNode:
                specificDeps['ts-node'] = typescript?.tsNode?.version ?? tryGetDependency('ts-node', packageJson)
                if (!specificDeps['ts-node']) {
                    throw new Error(`Cannot run by ts-node without a ts-node version supplied or discoverable in package.json!`)
                }
            break;
            case RunBy.Tsx:
                specificDeps['tsx'] = typescript?.tsNode?.version ?? tryGetDependency('tsx', packageJson)
                if (!specificDeps['tsx']) {
                    throw new Error(`Cannot run by tsx without a tsx version supplied or discoverable in package.json!`)
                }
            break;
            default:
                throw new Error('Unimplemented runBy dependencies for: ' + runBy)
        }
    })

    let protocol: string
    switch(pkgManager) {
        case PkgManager.YarnV4:
            // Yarn v4 does not play well with file:// since it tries zipping things it shouldn't
            protocol = 'portal:'
        default:
            protocol = 'file:'
    }

    return {
        name: `${protocol}${packageRelativePath}`,
        ...peerDependencies,
        ...specificDeps,
    }
}