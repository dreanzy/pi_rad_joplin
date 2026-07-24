/**
 * Joplin Extension for pi — Web Clipper REST API.
 * Requires JOPLIN_TOKEN. Save to ~/.pi/agent/extensions/index.ts, then /reload.
 */

import { keyHint, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";

// --- Config

function getBaseUrl(): string {
	return process.env.JOPLIN_BASE_URL || "http://localhost:41184";
}

function getToken(): string | undefined {
	return process.env.JOPLIN_TOKEN;
}

// --- HTTP wrapper

async function joplinApi(
	method: string,
	apiPath: string,
	body?: object,
): Promise<any> {
	const baseUrl = getBaseUrl();
	const token = getToken();
	if (!token) {
		throw new Error(
			"JOPLIN_TOKEN not set — set JOPLIN_TOKEN in your shell config\nGet from: Joplin → Settings → Web Clipper → Copy Token",
		);
	}

	const url = new URL(apiPath, baseUrl);
	url.searchParams.set("token", token);

	const headers: Record<string, string> = {
		"Content-Type": "application/json; charset=utf-8",
	};
	const opts: any = { method, headers };
	if (body && (method === "POST" || method === "PUT")) {
		opts.body = JSON.stringify(body);
	}

	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 30_000);
	opts.signal = ctrl.signal;

	try {
		const res = await fetch(url.toString(), opts);
		if (!res.ok) {
			const errText = await res.text().catch(() => "");
			throw new Error(`Joplin API ${res.status}: ${errText}`);
		}
		const txt = await res.text();
		clearTimeout(timer);
		// /ping returns plain text "JoplinClipperServer", other endpoints return JSON
		if (!txt) return { ok: true };
		try {
			return JSON.parse(txt);
		} catch {
			return { text: txt, ok: true };
		}
	} catch (err: any) {
		clearTimeout(timer);
		if (err.name === "AbortError") throw new Error("Joplin API timeout (30s)");
		if (err?.cause?.code === "ECONNREFUSED")
			throw new Error("Cannot connect to Joplin. Is it running?");
		throw err;
	}
}

// --- Formatting

function fmtMeta(n: any, i: number): string {
	const prefix = n.is_todo ? "☐" : "📄";
	const date = n.updated_time
		? new Date(n.updated_time).toLocaleString("zh-CN")
		: "N/A";
	return `${i + 1}. ${prefix} **${n.title}** \`${n.id}\`\n   📅 ${date}`;
}

// --- Utility functions

async function listFolders() {
	const allItems: any[] = [];
	let page = 1;
	for (;;) {
		const data = await joplinApi("GET", `/folders?limit=100&page=${page}`);
		const items: any[] = data.items || [];
		allItems.push(...items);
		if (!data.has_more) break;
		page++;
	}
	if (!allItems.length) return "No notebooks found.";
	return allItems
		.map((f, i) => `${i + 1}. **${f.title}** \`${f.id}\``)
		.join("\n");
}

async function listNotes(folderId?: string, limit = 30, page?: number) {
	const p = new URLSearchParams();
	if (folderId) p.set("folder_id", folderId);
	p.set("limit", String(limit));
	if (page) p.set("page", String(page));
	p.set("fields", "id,title,updated_time,is_todo");

	const data = await joplinApi("GET", `/notes?${p}`);
	const items: any[] = data.items || [];
	if (!items.length)
		return folderId ? "No notes in this folder." : "No notes found.";
	const lines = items.map(fmtMeta);
	if (data.has_more) lines.push(`\n> More pages (currently page ${page || 1})`);
	return lines.join("\n");
}

async function getNote(noteId: string) {
	const data = await joplinApi(
		"GET",
		`/notes/${noteId}?fields=id,title,body,updated_time,source_url,is_todo`,
	);
	const date = data.updated_time
		? new Date(data.updated_time).toLocaleString("zh-CN")
		: null;
	return [
		`## ${data.is_todo ? "☐" : "📄"} ${data.title}`,
		...(date ? [`📅 ${date}`] : []),
		...(data.source_url ? [`🔗 ${data.source_url}`] : []),
		`🆔 \`${data.id}\``,
		"",
		"---",
		"",
		data.body || "(empty)",
	].join("\n");
}

async function createNote(params: {
	title: string;
	body?: string;
	parent_id?: string;
	is_todo?: boolean;
}) {
	const b: any = { title: params.title };
	if (params.body) b.body = params.body;
	if (params.parent_id) b.parent_id = params.parent_id;
	if (params.is_todo !== undefined) b.is_todo = params.is_todo ? 1 : 0;
	const data = await joplinApi("POST", "/notes", b);
	return `✅ Created: **${data.title}** — ID: \`${data.id}\``;
}

async function updateNote(params: {
	note_id: string;
	title?: string;
	body?: string;
	parent_id?: string;
	is_todo?: boolean;
}) {
	const b: any = {};
	if (params.title !== undefined) b.title = params.title;
	if (params.body !== undefined) b.body = params.body;
	if (params.parent_id !== undefined) b.parent_id = params.parent_id;
	if (params.is_todo !== undefined) b.is_todo = params.is_todo ? 1 : 0;
	if (!Object.keys(b).length) return "⚠️ No fields to update.";
	const data = await joplinApi("PUT", `/notes/${params.note_id}`, b);
	return `✅ Updated: **${data.title}** — ID: \`${data.id}\``;
}

async function deleteNote(noteId: string) {
	await joplinApi("DELETE", `/notes/${noteId}`);
	return `✅ Note \`${noteId}\` deleted.`;
}

async function searchNotes(query: string, type = "note") {
	const data = await joplinApi(
		"GET",
		`/search?query=${encodeURIComponent(query)}&type=${type}`,
	);
	const items: any[] = data.items || [];
	if (!items.length) return `No results for "${query}".`;
	return items.map(fmtMeta).join("\n");
}

// --- Extension registration

export default function (pi: ExtensionAPI) {
	const ok = (text: string) => ({
		content: [{ type: "text" as const, text }],
		details: {},
	});
	// Connection check on session start
	pi.on("session_start", async (_event, ctx) => {
		const token = getToken();
		if (!token) {
			ctx.ui.notify("⚠️ Joplin: JOPLIN_TOKEN not set", "warning");
			return;
		}
		try {
			await joplinApi("GET", "/ping");
			ctx.ui.notify("📓 Joplin connected", "info");
		} catch (err: any) {
			ctx.ui.notify(`⚠️ Joplin: ${err.message}`, "warning");
		}
	});

	/** Truncate tool output for TUI, expand with Ctrl+O. */
	function makeRenderResult(maxLines = 10) {
		return (
			result: any,
			{ expanded, isPartial }: { expanded: boolean; isPartial: boolean },
			theme: any,
		) => {
			if (isPartial) {
				return new Text(theme.fg("warning", "Processing..."), 0, 0);
			}
			const text =
				result.content[0]?.type === "text" ? result.content[0].text : "";
			if (expanded) {
				return new Text(text, 0, 0);
			}
			const lines = text.split("\n");
			if (lines.length <= maxLines) {
				return new Text(text, 0, 0);
			}
			const truncated = lines.slice(0, maxLines).join("\n");
			const remaining = lines.length - maxLines;
			const hint = keyHint("app.tools.expand", "expand");
			return new Text(
				`${truncated}\n${theme.fg("dim", `... ${remaining} more lines (${hint})`)}`,
				0,
				0,
			);
		};
	}

	// ---- joplin_list_folders ----
	pi.registerTool({
		name: "joplin_list_folders",
		label: "Joplin List Notebooks",
		description: "List all Joplin notebooks (folders) with names and IDs.",
		promptSnippet: "List all Joplin notebooks",
		promptGuidelines: [
			"Use returned folder IDs with joplin_list_notes to filter notes by notebook",
		],
		parameters: Type.Object({}),
		async execute() {
			return ok(await listFolders());
		},
		renderResult: makeRenderResult(10),
	});

	// ---- joplin_list_notes ----
	pi.registerTool({
		name: "joplin_list_notes",
		label: "Joplin List Notes",
		description: "List Joplin notes. Filter by folder_id, supports pagination.",
		promptSnippet: "List Joplin notes",
		promptGuidelines: [
			"If user mentions a notebook name, get folder_id from joplin_list_folders first",
		],
		parameters: Type.Object({
			folder_id: Type.Optional(
				Type.String({ description: "Notebook ID to filter by" }),
			),
			limit: Type.Optional(
				Type.Number({ description: "Notes per page (default 30)" }),
			),
			page: Type.Optional(Type.Number({ description: "Page number, 1-based" })),
		}),
		async execute(_id, params) {
			return ok(await listNotes(params.folder_id, params.limit, params.page));
		},
		renderResult: makeRenderResult(10),
	});

	// ---- joplin_get_note ----
	pi.registerTool({
		name: "joplin_get_note",
		label: "Joplin Get Note",
		description: "Read a Joplin note's full content (title + body) by ID.",
		promptSnippet: "Read a Joplin note by ID",
		promptGuidelines: [
			"Note ID comes from joplin_list_notes or joplin_search results",
		],
		parameters: Type.Object({
			note_id: Type.String({ description: "Note ID" }),
		}),
		async execute(_id, params) {
			return ok(await getNote(params.note_id));
		},
		renderResult: makeRenderResult(15),
	});

	// ---- joplin_create_note ----
	pi.registerTool({
		name: "joplin_create_note",
		label: "Joplin Create Note",
		description: "Create a new note in Joplin. Body supports Markdown.",
		promptSnippet: "Create a new Joplin note",
		promptGuidelines: [
			"Get parent_id from joplin_list_folders if targeting a specific notebook",
		],
		parameters: Type.Object({
			title: Type.String({ description: "Note title" }),
			body: Type.Optional(Type.String({ description: "Note body (Markdown)" })),
			parent_id: Type.Optional(
				Type.String({ description: "Target notebook ID (optional)" }),
			),
			is_todo: Type.Optional(
				Type.Boolean({ description: "Create as to-do item (default false)" }),
			),
		}),
		async execute(_id, params) {
			return ok(await createNote(params));
		},
	});

	// ---- joplin_update_note ----
	pi.registerTool({
		name: "joplin_update_note",
		label: "Joplin Update Note",
		description:
			"Update title, body, or notebook of an existing note. Only pass changed fields — omitted fields stay as-is.",
		promptSnippet: "Update a Joplin note",
		promptGuidelines: [],
		parameters: Type.Object({
			note_id: Type.String({ description: "Note ID to update" }),
			title: Type.Optional(
				Type.String({ description: "New title (optional)" }),
			),
			body: Type.Optional(
				Type.String({ description: "New body in Markdown (optional)" }),
			),
			parent_id: Type.Optional(
				Type.String({ description: "Move to this notebook ID (optional)" }),
			),
			is_todo: Type.Optional(
				Type.Boolean({ description: "Toggle to-do flag (optional)" }),
			),
		}),
		async execute(_id, params) {
			return ok(await updateNote(params));
		},
	});

	// ---- joplin_delete_note ----
	pi.registerTool({
		name: "joplin_delete_note",
		label: "Joplin Delete Note",
		description:
			"⚠️ Permanently delete a Joplin note (no recycle bin). Always confirm with user first.",
		promptSnippet: "Delete a Joplin note — confirm first!",
		promptGuidelines: [
			"⚠️ IRREVERSIBLE. Always confirm with user before calling!",
		],
		parameters: Type.Object({
			note_id: Type.String({ description: "Note ID to delete" }),
		}),
		async execute(_id, params) {
			return ok(await deleteNote(params.note_id));
		},
	});

	// ---- joplin_search ----
	pi.registerTool({
		name: "joplin_search",
		label: "Joplin Search",
		description:
			"Full-text search across all Joplin notes. Returns matching titles and IDs.",
		promptSnippet: "Full-text search in Joplin",
		promptGuidelines: [
			"Pass resulting note IDs to joplin_get_note to read full content",
		],
		parameters: Type.Object({
			query: Type.String({ description: "Search keyword(s)" }),
			type: Type.Optional(
				Type.String({
					description: "Search type: 'note' (default), 'folder', or 'tag'",
				}),
			),
		}),
		async execute(_id, params) {
			return ok(await searchNotes(params.query, params.type));
		},
		renderResult: makeRenderResult(10),
	});

	// ---- /joplin command ----
	pi.registerCommand("joplin", {
		description: "Check Joplin connection status",
		handler: async (_args, ctx) => {
			const token = getToken();
			if (!token) {
				ctx.ui.notify(
					"❌ JOPLIN_TOKEN not set. Add: export JOPLIN_TOKEN=...",
					"error",
				);
				return;
			}
			try {
				await joplinApi("GET", "/ping");
				ctx.ui.notify(`✅ Joplin connected — ${getBaseUrl()}`, "info");
			} catch (err: any) {
				ctx.ui.notify(`❌ ${err.message}`, "error");
			}
		},
	});
}
