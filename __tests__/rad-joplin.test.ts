import { describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("joplin API helpers", () => {
	it("registers all tools on extension init", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: () =>
				Promise.resolve(
					JSON.stringify({ items: [{ id: "1", title: "Test" }] }),
				),
		});
		const mod = await import("../extensions/index.js");
		const pi = { registerTool: vi.fn(), on: vi.fn(), registerCommand: vi.fn() };
		mod.default(pi as any);

		const toolNames = pi.registerTool.mock.calls.map((c: any[]) => c[0].name);
		expect(toolNames).toContain("joplin_list_folders");
		expect(toolNames).toContain("joplin_list_notes");
		expect(toolNames).toContain("joplin_get_note");
		expect(toolNames).toContain("joplin_create_note");
		expect(toolNames).toContain("joplin_update_note");
		expect(toolNames).toContain("joplin_delete_note");
		expect(toolNames).toContain("joplin_search");
	});

	it("registers session_start handler and /joplin command", async () => {
		const mod = await import("../extensions/index.js");
		const pi = { registerTool: vi.fn(), on: vi.fn(), registerCommand: vi.fn() };
		mod.default(pi as any);
		expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
		expect(pi.registerCommand).toHaveBeenCalledWith(
			"joplin",
			expect.any(Object),
		);
	});
});
