export const STEP1_SCOPE = {
	reScope: "current-tp005-tp006-surfaces",
	deferredAssertions: [
		"TP-007 smart-routing, multi-endpoint fallback, and partial-success aggregation",
		"TP-008 per-call pricing model and cumulative usage reporting",
	],
} as const;

export const MANUAL_ROUTING_SCENARIOS = [
	{
		label: "broad lookup",
		toolName: "kagi_search",
		arguments: { query: "sqlite wal checkpoint behavior", limit: 3 },
		reason: "default web lookup with direct citations",
	},
	{
		label: "independent perspectives",
		toolName: "kagi_enrich_web",
		arguments: { query: "litestream production lessons" },
		reason: "non-commercial blogs and community sources",
	},
	{
		label: "recent discussions",
		toolName: "kagi_enrich_news",
		arguments: { query: "recent browser engine news" },
		reason: "latest and current-events style requests",
	},
	{
		label: "grounded answer",
		toolName: "kagi_fastgpt",
		arguments: { query: "What changed in Python 3.11?", cache: false },
		reason: "synthesized answer with citations",
	},
	{
		label: "url summary",
		toolName: "kagi_summarize",
		arguments: { url: "https://example.com/article", engine: "agnes", summary_type: "takeaway" },
		reason: "direct document summarization from a URL",
	},
	{
		label: "pasted text summary",
		toolName: "kagi_summarize",
		arguments: { text: "Short pasted text to summarize.", target_language: "EN" },
		reason: "summarizing inline text without a URL",
	},
	{
		label: "small web browsing",
		toolName: "kagi_smallweb",
		arguments: { limit: 2 },
		reason: "serendipitous browsing of curated independent sites",
	},
] as const;

export const SEARCH_RAW_RESPONSE = {
	meta: {
		id: "search-meta",
		node: "us-east4",
		ms: 18,
		api_balance: 42.5,
	},
	data: [
		{
			t: 0,
			url: "https://example.com/sqlite-wal",
			title: "SQLite WAL Guide",
			snippet: "Write-ahead logging basics and caveats.",
			published: "2024-05-01T00:00:00Z",
			rank: 1,
		},
		{
			t: 1,
			list: ["sqlite wal checkpoint busy timeout"],
		},
	],
} as const;

export const ENRICH_WEB_RAW_RESPONSE = {
	meta: {
		id: "enrich-web-meta",
		node: "us-east4",
		ms: 15,
		api_balance: 42.49,
	},
	data: [
		{
			t: 0,
			url: "https://indie.example/litestream",
			title: "Running Litestream in Production",
			snippet: "Operational notes from an independent developer.",
			rank: 1,
		},
	],
} as const;

export const ENRICH_NEWS_RAW_RESPONSE = {
	meta: {
		id: "enrich-news-meta",
		node: "us-east4",
		ms: 17,
		api_balance: 42.48,
	},
	data: [
		{
			t: 0,
			url: "https://news.example/browser-engines",
			title: "Browser Engine Watch",
			snippet: "Recent movement across major engines.",
			published: "2024-06-10T00:00:00Z",
			rank: 1,
		},
	],
} as const;

export const FASTGPT_RAW_RESPONSE = {
	meta: {
		id: "fastgpt-meta",
		node: "us-east4",
		ms: 34,
		api_balance: 42.46,
	},
	data: {
		output: "Python 3.11 improved performance [1] and exception groups [2].",
		tokens: 757,
		references: [
			{
				title: "What's New In Python 3.11",
				snippet: "Official release notes",
				url: "https://docs.python.org/3/whatsnew/3.11.html",
			},
			{
				title: "Earthly blog",
				snippet: "Feature overview",
				url: "https://earthly.dev/blog/python-3-11-new-features/",
			},
		],
	},
} as const;

export const SUMMARIZE_URL_RAW_RESPONSE = {
	meta: {
		id: "summarize-url-meta",
		node: "us-east4",
		ms: 21,
		api_balance: 42.45,
	},
	data: {
		output: "• Key takeaway one\n• Key takeaway two",
		tokens: 500,
	},
} as const;

export const SUMMARIZE_TEXT_RAW_RESPONSE = {
	meta: {
		id: "summarize-text-meta",
		node: "us-east4",
		ms: 19,
		api_balance: 42.44,
	},
	data: {
		output: "Short pasted summary.",
		tokens: 120,
	},
} as const;

export const SMALLWEB_RAW_RESPONSE = {
	data: {
		entries: [
			{
				title: "A Handmade Blog",
				url: "https://small.example/handmade",
				snippet: "Notes from an independent site.",
				author: "Jane Example",
				published: "2024-06-01T00:00:00Z",
			},
			{
				title: "Quiet Corner",
				url: "https://small.example/quiet",
				snippet: "",
			},
		],
	},
} as const;
