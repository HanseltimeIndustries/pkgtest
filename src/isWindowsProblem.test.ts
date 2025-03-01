import { isWindowsProblem } from "./isWindowsProblem"
import { PkgManager } from "./types"

let originalPlatform: string = process.platform;
let originalVersion: string = process.version;

afterAll(function () {
	Object.defineProperty(process, "platform", {
		value: originalPlatform,
	});
    Object.defineProperty(process, "version", {
		value: originalVersion,
	});
});

const v18 = 'v18.21.2';
const v20 = 'v20.2.1';
const v22 = 'v22.22.1';

const ALL_VERSIONS = [v18, v20, v22]

it.each([
    ...ALL_VERSIONS.map((v) => ([
        {
            packageManager: PkgManager.YarnV1,
            alias: 'some alias',
        },
        v,
        true,
    ])),
    ...ALL_VERSIONS.map((v) => ([
        {
            packageManager: PkgManager.Npm,
            alias: 'some alias',
        },
        v,
        false,
    ])),
    ...ALL_VERSIONS.map((v) => ([
        {
            packageManager: PkgManager.Pnpm,
            alias: 'some alias',
        },
        v,
        false,
    ])),
    // Default berry is pnp
    ...ALL_VERSIONS.map((v) => ([
        {
            packageManager: PkgManager.YarnBerry,
            alias: 'some alias',
        },
        v,
        v === v18,
    ])),
    // pnp provided in options
    ...ALL_VERSIONS.map((v) => ([
        {
            packageManager: PkgManager.YarnBerry,
            alias: 'some alias',
            options: {
                yarnrc: {
                    nodeLinker: 'pnp'
                }
            }
        },
        v,
        v === v18,
    ])),
    // Non-pnp is fine
    ...ALL_VERSIONS.map((v) => ([
        {
            packageManager: PkgManager.YarnBerry,
            alias: 'some alias',
            options: {
                yarnrc: {
                    nodeLinker: 'pnpm'
                }
            }
        },
        v,
        false,
    ])),
    // Non-pnp is fine
    ...ALL_VERSIONS.map((v) => ([
        {
            packageManager: PkgManager.YarnBerry,
            alias: 'some alias',
            options: {
                yarnrc: {
                    nodeLinker: 'node-modules'
                }
            }
        },
        v,
        false,
    ])),
])('%s (node: %s) returns %s', (options, version, exp) => {
    Object.defineProperty(process, "platform", {
		value: "win32",
	});
    Object.defineProperty(process, "version", {
		value: version,
	});
    expect(isWindowsProblem({
        packageManager: PkgManager.YarnV1,
        alias: 'some alias',
    })).toBe(true)
})

it('retrns false on non-win32', () => {
    Object.defineProperty(process, "platform", {
		value: "darwin",
	});
    expect(isWindowsProblem({
        packageManager: PkgManager.YarnV1,
        alias: 'some alias',
    })).toBe(false)
})