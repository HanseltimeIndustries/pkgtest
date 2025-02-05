import { join } from "path";
import { TypescriptOptions } from "./types";
import type { TsConfigJson } from "get-tsconfig";

export function getTypescriptConfig(
	context: {
		tsSrcDir: string;
		tsBuildDir: string;
		modType: "commonjs" | "esm";
	},
	options: TypescriptOptions,
): TsConfigJson & { compilerOptions: { outDir: string } } {
	const { modType, tsSrcDir, tsBuildDir } = context;
	const moduleTsConfigProps = {} as {
		target: TsConfigJson.CompilerOptions.Target;
		module: TsConfigJson.CompilerOptions.Module;
		outDir: string;
	};
	switch (modType) {
		case "commonjs":
			moduleTsConfigProps.target = "es2020";
			moduleTsConfigProps.module = "commonjs";
			moduleTsConfigProps.outDir = join(tsBuildDir, "cjs");
			break;
		case "esm":
			moduleTsConfigProps.module = "esnext";
			moduleTsConfigProps.target = "esnext";
			moduleTsConfigProps.outDir = join(tsBuildDir, "esm");
			break;
		default:
			throw new Error(
				`Unimplemented typescript module type mapping for module type ${modType}`,
			);
	}

	// Create a typescript config
	const { compilerOptions = {}, exclude = [], ...rest } = options.config ?? {};
	const { outDir, ...softProps } = moduleTsConfigProps;
	const tsConfig = {
		// This is the base tsconfig.json that is used to map to SWC configurations via tsconfig-to-swcconfig/tswc
		// Please verify any exotic options that might not map to swc (try to stick to swc equivalents so that
		//    you can support esm/commonjs builds)
		compilerOptions: {
			...softProps,
			strict: true,
			moduleResolution: "node" as TsConfigJson.CompilerOptions.ModuleResolution,
			sourceMap: true,
			rootDir: tsSrcDir,
			isolatedModules: true,
			types: ["node"],
			...compilerOptions,
			outDir,
		},
		exclude: Array.from(new Set([...exclude, tsBuildDir, "node_modules"])),
		...rest,
	};
	return tsConfig;
}
