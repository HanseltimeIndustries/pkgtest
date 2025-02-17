export function injectVariablesInString(
	vars: {
		[v: string]: string;
	},
	str: string,
): string {
	return Object.keys(vars).reduce((s, v) => {
		return s.replaceAll(new RegExp("(?<!\\\\)\\${" + v + "}", "g"), vars[v]);
	}, str);
}

export function injectVariablesInObject(
	vars: {
		[v: string]: string;
	},
	obj: any,
) {
	if (Array.isArray(obj)) {
		return obj.reduce((newArr, mObj) => {
			newArr.push(injectVariablesInObject(vars, mObj));
			return newArr;
		}, []);
	}
	if (obj !== null && typeof obj === "object") {
		return Object.keys(obj).reduce((o, k) => {
			o[k] = injectVariablesInObject(vars, obj[k]);
			return o;
		}, {} as any);
	}
	if (typeof obj === "string") {
		return injectVariablesInString(vars, obj);
	}
	return obj;
}
