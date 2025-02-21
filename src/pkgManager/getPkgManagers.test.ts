import { ModuleTypes, PkgManager } from "../types"
import { getPkgManagers } from "./getPkgManagers"

it('retrieves all package managers', () => {
    const res = getPkgManagers([
        {
            moduleTypes: [ModuleTypes.Commonjs],
            alias: 'entry1',
            packageManagers: [
                {
                    packageManager: PkgManager.YarnV1,
                    alias: 'a1',
                },
                {
                    packageManager: PkgManager.YarnV1,
                    alias: 'a2',
                },
                {
                    packageManager: PkgManager.YarnBerry,
                    alias: 'b1',
                }
            ]
        },
        {
            moduleTypes: [ModuleTypes.Commonjs],
            alias: 'entry2',
            packageManagers: [
                {
                    packageManager: PkgManager.Pnpm,
                    alias: 'c1',
                },
                {
                    packageManager: PkgManager.YarnBerry,
                    alias: 'd1',
                }
            ]
        },
        {
            moduleTypes: [ModuleTypes.Commonjs],
            alias: 'entry3',
            packageManagers: [
                {
                    packageManager: PkgManager.Pnpm,
                    alias: 'e1',
                }
            ]
        }
    ])
    const expectedPkgManagers = [PkgManager.Pnpm, PkgManager.YarnV1, PkgManager.YarnV1];
    expect(res.length).toEqual(expectedPkgManagers.length)
    expect(res).toEqual(expect.arrayContaining(expectedPkgManagers))
})