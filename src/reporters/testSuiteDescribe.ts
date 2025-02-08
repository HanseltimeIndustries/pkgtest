import { ModuleTypes, PkgManager, RunBy } from "../types";
import chalk from "chalk";

export function testSuiteDescribe(opts: {
	modType: ModuleTypes;
	pkgManager: PkgManager;
	pkgManagerAlias: string;
	runBy: RunBy;
}) {
	return `Test Suite for Module ${opts.modType}, Package Manager ${opts.pkgManager} (${chalk.magenta(opts.pkgManagerAlias)}), Run with ${opts.runBy}`;
}
