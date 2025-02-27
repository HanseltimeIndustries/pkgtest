import { resolve } from "path";
import { CollectLogFilesOn, CollectLogFileStages } from "../types";
import { createTopLevelLogFilesScanner } from "./createTopLevelLogFilesScanner";
import { ILogFilesScanner } from "./ForLogFilesScanner";
import { getLogCollectFolder } from "../files";

const testDate = new Date("2020-01-01");
jest.useFakeTimers().setSystemTime(testDate);

var mockForLogFilesScannerConst: jest.Mock;
jest.mock("./ForLogFilesScanner", () => {
	mockForLogFilesScannerConst = jest.fn();
	return {
		ForLogFilesScanner: mockForLogFilesScannerConst,
	};
});

const mockForLogFilesScannerInstance: ILogFilesScanner = {
	scanOnly: jest.fn(),
	createNested: jest.fn(),
	collectLogFiles: jest.fn(),
};

beforeEach(() => {
	jest.resetAllMocks();
	mockForLogFilesScannerConst.mockReturnValue(mockForLogFilesScannerInstance);
});

it("returns a no scan case (undefined)", () => {
	expect(createTopLevelLogFilesScanner({})).toEqual({
		collect: {
			setup: false,
			fileTests: false,
			binTests: false,
			scriptTests: false,
		},
	});
});

it("returns a non scan case (empty stages array)", () => {
	expect(
		createTopLevelLogFilesScanner({
			collectLogFilesStages: [],
		}),
	).toEqual({
		collect: {
			setup: false,
			fileTests: false,
			binTests: false,
			scriptTests: false,
		},
	});
});

it("throws an error if 1 missing (on)", () => {
	expect(() =>
		createTopLevelLogFilesScanner({
			collectLogFilesStages: [CollectLogFileStages.FileTests],
		}),
	).toThrow(`Must supply both collectLogFilesOn and collectLogFilesStages!`);
});

it("throws an error if 1 missing (stages)", () => {
	expect(() =>
		createTopLevelLogFilesScanner({
			collectLogFilesOn: CollectLogFilesOn.All,
		}),
	).toThrow(`Must supply both collectLogFilesOn and collectLogFilesStages!`);
});

it("throws an error if 1 missing (stages empty)", () => {
	expect(() =>
		createTopLevelLogFilesScanner({
			collectLogFilesOn: CollectLogFilesOn.All,
			collectLogFilesStages: [],
		}),
	).toThrow(`Must supply both collectLogFilesOn and collectLogFilesStages!`);
});

it.each([
	[
		CollectLogFilesOn.Error,
		[CollectLogFileStages.Setup],
		{
			setup: true,
			fileTests: false,
			binTests: false,
			scriptTests: false,
		},
	],
	[
		CollectLogFilesOn.All,
		[CollectLogFileStages.FileTests],
		{
			setup: false,
			fileTests: true,
			binTests: false,
			scriptTests: false,
		},
	],
	[
		CollectLogFilesOn.All,
		[CollectLogFileStages.BinTests],
		{
			setup: false,
			fileTests: false,
			binTests: true,
			scriptTests: false,
		},
	],
	[
		CollectLogFilesOn.All,
		[CollectLogFileStages.ScriptTests],
		{
			setup: false,
			fileTests: false,
			binTests: false,
			scriptTests: true,
		},
	],
	[
		CollectLogFilesOn.All,
		[CollectLogFileStages.ScriptTests, CollectLogFileStages.BinTests],
		{
			setup: false,
			fileTests: false,
			binTests: true,
			scriptTests: true,
		},
	],
	[
		CollectLogFilesOn.All,
		[
			CollectLogFileStages.ScriptTests,
			CollectLogFileStages.Tests,
			CollectLogFileStages.Setup,
		],
		{
			setup: true,
			fileTests: true,
			binTests: true,
			scriptTests: true,
		},
	],
	[
		CollectLogFilesOn.All,
		[CollectLogFileStages.All],
		{
			setup: true,
			fileTests: true,
			binTests: true,
			scriptTests: true,
		},
	],
	[
		CollectLogFilesOn.All,
		[CollectLogFileStages.None],
		{
			setup: false,
			fileTests: false,
			binTests: false,
			scriptTests: false,
		},
	],
])(
	"returns the correcct configuration (on: %s, stages %s)",
	(on, stages, collectExpected) => {
		expect(
			createTopLevelLogFilesScanner({
				collectLogFilesOn: on,
				collectLogFilesStages: stages,
			}),
		).toEqual({
			topLevelScanner: mockForLogFilesScannerInstance,
			collect: collectExpected,
		});

		// TOOD: verify the prefixing
		expect(mockForLogFilesScannerConst).toHaveBeenCalledWith(
			resolve(getLogCollectFolder(), "run-" + new Date().getTime()),
			on,
		);
	},
);
