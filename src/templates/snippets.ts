export default (keywords: string[]) => {
	const snippets: [string, object][] = [];

	if (keywords.includes("if")) {
		snippets.push([
			"If Statement",
			{
				prefix: "if",
				body: ["if (${1:condition})", "{", "\t$TM_SELECTED_TEXT$0", "}"],
				description: "If Statement",
			},
		]);

		if (keywords.includes("else")) {
			snippets.push([
				"If-Else Statement",
				{
					prefix: "ifelse",
					body: ["if (${1:condition})", "{", "\t$TM_SELECTED_TEXT$0", "}", "else", "{", "\t", "}"],
					description: "If-Else Statement",
				},
			]);
		}
	}

	if (keywords.includes("switch")) {
		snippets.push([
			"Switch Statement",
			{
				prefix: "switch",
				body: [
					"switch (${1:variable})",
					"{",
					"\tcase ${2:value}:",
					"\t\t$TM_SELECTED_TEXT$0",
					"\t\tbreak;",
					"",
					"\tdefault:",
					"\t\tbreak;",
					"}",
				],
				description: "Switch Statement",
			},
		]);
	}

	if (keywords.includes("while")) {
		snippets.push([
			"While Loop",
			{
				prefix: "while",
				body: ["while (${1:condition})", "{", "\t$TM_SELECTED_TEXT$0", "}"],
				description: "While Loop",
			},
		]);
	}

	if (keywords.includes("for")) {
		snippets.push([
			"For Loop",
			{
				prefix: "for",
				body: ["for (${1:i} = ${2:0}; ${1:i} < $3; ${1:i}++)", "{", "\t$TM_SELECTED_TEXT$0", "}"],
				description: "For Loop",
			},
		]);
	}

	if (keywords.includes("foreach")) {
		snippets.push([
			"For-Each Loop",
			{
				prefix: "foreach",
				body: ["foreach (${1:element} in ${2:array})", "{", "\t$TM_SELECTED_TEXT$0", "}"],
				description: "For-Each Loop",
			},
		]);
	}

	snippets.push([
		"Function",
		{
			prefix: "function",
			body: ["${1:function}($2)", "{", "\t$TM_SELECTED_TEXT$0", "}"],
			description: "Function",
		},
	]);

	snippets.push([
		"Include",
		{
			prefix: "include",
			body: ["#include $TM_SELECTED_TEXT$0;"],
			description: "Include",
		},
	]);

	snippets.push([
		"Animation Tree",
		{
			prefix: "animtree",
			body: ['#using_animtree("$TM_SELECTED_TEXT$0");'],
			description: "Animation Tree",
		},
	]);

	snippets.push([
		"Color",
		{
			prefix: "color",
			body: ["(${1:red}/255, ${2:green}/255, ${3:blue}/255)"],
			description: "Color vector",
		},
	]);

	return Object.fromEntries(snippets);
};
