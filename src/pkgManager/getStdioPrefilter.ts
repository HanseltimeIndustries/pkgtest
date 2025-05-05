import { PkgManager } from "../types";

/**
 * When using corepack to run things, corepack will add some additional lines of
 * text, which can break stdio match checks
 *
 * yarn v1:
 *  yarn run v1.22.22\n$ node -e 'console.log("hello")'\n
 * npm:
 *  \n> @dummy-test-package/test-commonjs@0.0.0 hello /tmp/pkgtest-zDybkv\n> node -e 'console.log("hello")'\n
 * pnpm:
 *  \n> @dummy-test-package/test-commonjs@0.0.0 hello\n> node -e 'console.log("hello")'\n
 */
export function getStdioPrefilter(pkgManager: PkgManager) {
	switch (pkgManager) {
		case PkgManager.Npm:
		case PkgManager.Pnpm:
			return (s: string) => {
				if (s.startsWith("\n>")) {
					const secondLine = s.indexOf("\n>", 1);
					if (secondLine > 2) {
						const lastLine = s.indexOf("\n", secondLine + 1);
						if (lastLine > secondLine) return lastLine + 1;
					}
				}
				return 0;
			};
		case PkgManager.YarnV1:
			return (s: string) => {
				if (s.startsWith("yarn ")) {
					const secondLine = s.indexOf("\n$", 1);
					if (secondLine > 2) {
						const lastLine = s.indexOf("\n", secondLine + 1);
						if (lastLine > secondLine) return lastLine + 1;
					}
				}
				return 0;
			};
		case PkgManager.YarnBerry:
			return undefined;
		default:
			throw new Error(
				`Unimplemented pkg binary runner command for ${pkgManager}`,
			);
	}
}
