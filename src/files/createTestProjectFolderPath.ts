import camelCase from "lodash.camelcase";
import { join } from "path";
import { ModuleTypes, PkgManager } from "../types";

export function createTestProjectFolderPath(options: {
	entryAlias: string;
	modType: ModuleTypes;
	pkgManager: PkgManager;
	pkgManagerAlias: string;
}) {
	const { entryAlias, modType, pkgManager, pkgManagerAlias } = options;
	return join(
		camelCase(entryAlias),
		modType,
		pkgManager,
		camelCase(pkgManagerAlias),
	);
}
