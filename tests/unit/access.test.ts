import { describe, expect, it } from "vitest";

import {
  createLocalImportWorkflow,
  fetchDirectLore,
} from "../../src/lore/access";
import { parseLoreReference } from "../../src/lore/urls";

describe("Lore access", () => {
  it("creates the exact current local-import workflow", () => {
    const workflow = createLocalImportWorkflow("<id@example.test>");
    expect(workflow.downloadUrl).toBe(
      "https://lore.kernel.org/all/id%40example.test/t.mbox.gz",
    );
    expect(workflow.instruction).toContain("complete-thread archive");
  });

  it("keeps direct loading disabled by default", async () => {
    await expect(
      fetchDirectLore(parseLoreReference("id@example.test"), new AbortController().signal),
    ).rejects.toMatchObject({ code: "direct-disabled" });
  });

  it("reports HTTP and missing-CORS failures without retrying", async () => {
    const fetchImpl: typeof fetch = async () => new Response("unavailable", { status: 503 });
    await expect(
      fetchDirectLore(parseLoreReference("id@example.test"), new AbortController().signal, {
        enabled: true,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "http-error" });
  });

  it("accepts only a CORS-readable bounded response when enabled", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("message", {
        status: 200,
        headers: { "access-control-allow-origin": "https://example.github.io" },
      });
    await expect(
      fetchDirectLore(parseLoreReference("id@example.test"), new AbortController().signal, {
        enabled: true,
        fetchImpl,
        maxBytes: 100,
      }),
    ).resolves.toEqual(new TextEncoder().encode("message"));
  });
});
