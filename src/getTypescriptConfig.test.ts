import { join } from "path";
import { getTypescriptConfig } from "./getTypescriptConfig";
import { type TsConfigJson } from "get-tsconfig";

const testSrcDir = "src";
const testBuildDir = "build";

it("applies a default base config for commonjs", () => {
	const expectedOutDir = join(testBuildDir, "cjs");
	expect(
		getTypescriptConfig(
			{
				tsSrcDir: testSrcDir,
				tsBuildDir: testBuildDir,
				modType: "commonjs",
			},
			{},
		),
	).toEqual({
		compilerOptions: {
			target: "es2020",
			module: "commonjs",
			outDir: expectedOutDir,
			strict: true,
			moduleResolution: "node",
			sourceMap: true,
			rootDir: testSrcDir,
			isolatedModules: true,
			types: ["node"],
		},
		exclude: [testBuildDir, "node_modules"],
	});
});

it("applies a default base config for esm", () => {
	const expectedOutDir = join(testBuildDir, "esm");
	expect(
		getTypescriptConfig(
			{
				tsSrcDir: testSrcDir,
				tsBuildDir: testBuildDir,
				modType: "esm",
			},
			{},
		),
	).toEqual({
		compilerOptions: {
			target: "esnext",
			module: "esnext",
			outDir: expectedOutDir,
			strict: true,
			moduleResolution: "node",
			sourceMap: true,
			rootDir: testSrcDir,
			isolatedModules: true,
			types: ["node"],
		},
		exclude: [testBuildDir, "node_modules"],
	});
});

it("Overrides the default config for commonjs with config", () => {
	const expectedOutDir = join(testBuildDir, "cjs");
	const configOverride = {
		compilerOptions: {
			target: "es2015" as TsConfigJson.CompilerOptions.Target,
			strict: false,
			types: ["node", "jest"],
		},
		exclude: [
			"sommething",
			// We expect node_modules and build dir to be supplied regardless
		],
		include: ["something"],
		another: false,
	};
	const { compilerOptions, exclude, ...rest } = configOverride;
	expect(
		getTypescriptConfig(
			{
				tsSrcDir: testSrcDir,
				tsBuildDir: testBuildDir,
				modType: "commonjs",
			},
			{
				config: configOverride,
			},
		),
	).toEqual({
		...rest,
		compilerOptions: {
			module: "commonjs",
			outDir: expectedOutDir,
			moduleResolution: "node",
			sourceMap: true,
			rootDir: testSrcDir,
			isolatedModules: true,
			...compilerOptions,
		},
		exclude: [...exclude, testBuildDir, "node_modules"],
	});
});

it("Overrides the default config for commonjs with config", () => {
	const expectedOutDir = join(testBuildDir, "esm");
	const configOverride = {
		compilerOptions: {
			target: "es2015" as TsConfigJson.CompilerOptions.Target,
			strict: false,
			types: ["node", "jest"],
		},
		exclude: [
			"sommething",
			// We expect node_modules and build dir to be supplied regardless
		],
		include: ["something"],
		another: false,
	};
	const { compilerOptions, exclude, ...rest } = configOverride;
	expect(
		getTypescriptConfig(
			{
				tsSrcDir: testSrcDir,
				tsBuildDir: testBuildDir,
				modType: "esm",
			},
			{
				config: configOverride,
			},
		),
	).toEqual({
		...rest,
		compilerOptions: {
			module: "esnext",
			outDir: expectedOutDir,
			moduleResolution: "node",
			sourceMap: true,
			rootDir: testSrcDir,
			isolatedModules: true,
			...compilerOptions,
		},
		exclude: [...exclude, testBuildDir, "node_modules"],
	});
});
