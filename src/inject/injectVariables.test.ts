import { injectVariablesInObject } from "./injectVariables";

it("injects in an object", () => {
	expect(
		injectVariablesInObject(
			{
				foo: "bar",
				something: "here",
			},
			{
				arr: [
					"a regular value",
					{
						o1: "hey${foo} and ${foo} and ${nothing}",
						val2: [
							"${something}",
							"$something",
							"\\${something} that's escaped",
						],
					},
				],
				another: 1,
				another2: "2:foo",
				bool: false,
				and: "${foo}${something}${foo}",
			},
		),
	).toEqual({
		arr: [
			"a regular value",
			{
				o1: "heybar and bar and ${nothing}",
				val2: ["here", "$something", "\\${something} that's escaped"],
			},
		],
		another: 1,
		another2: "2:foo",
		bool: false,
		and: "barherebar",
	});
});
