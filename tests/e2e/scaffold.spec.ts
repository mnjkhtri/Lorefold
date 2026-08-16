import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("renders the open page heading", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "linux kernel threads" })).toBeVisible();
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    "content",
    /default-src 'self'/u,
  );
});

test("opens an automatically generated LKML thread", async ({ page }) => {
  await page.goto("./");
  const thread = page.locator(".latest-threads button").first();
  await expect(thread).toBeVisible();
  await thread.click();
  await expect(page.getByRole("heading", { name: "Parsed thread" })).toBeVisible();
  await expect(page.locator(".message-article").first()).toBeVisible();
});

test("has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("./");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"))
    .toEqual([]);
});

test("exposes keyboard help and keeps focus visible", async ({ page }) => {
  await page.goto("./#/import");
  await page.getByText("Keyboard help").click();
  await expect(page.getByText(/Use Tab to move/)).toBeVisible();
  const chooseButton = page.getByRole("button", { name: "Choose mail archive" });
  await chooseButton.focus();
  await expect(chooseButton).toBeFocused();
});

test("stays readable and within the viewport on a narrow dark reduced-motion screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("./");

  await expect(page.getByRole("heading", { name: "linux kernel threads" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(17, 24, 28)",
  );
});

test("keeps the document within an Android-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("./");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(393);
});

test("reopens a saved thread with raw content after networking is disabled", async ({ page, context }) => {
  await page.goto("./#/saved");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("lorefold", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("threads", { keyPath: "thread.id" });
        store.createIndex("saved", "saved");
        store.createIndex("lastOpenedAt", "lastOpenedAt");
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("threads", "readwrite");
        transaction.objectStore("threads").put({
          thread: {
            schemaVersion: 1,
            id: "offline-thread",
            source: { kind: "local-file", importedFilename: "offline.eml", contentDigest: "test" },
            subject: "Offline saved discussion",
            messages: {
              "message-1": {
                id: "message-1",
                messageId: "<offline@example.test>",
                references: [],
                missingAncestorIds: [],
                author: { name: "Offline Author", address: "author@example.test" },
                timestamp: { valid: false, raw: "not a date" },
                subject: "Offline saved discussion",
                mailingLists: [],
                blocks: [{ kind: "paragraph", text: "This message was read from IndexedDB." }],
                patchIds: [],
                attachmentMetadata: [],
                sourceOrdinal: 0,
                diagnostics: [],
              },
            },
            rootIds: ["message-1"],
            childrenByParent: {},
            chronologicalIds: ["message-1"],
            patchSeries: [],
            diagnostics: [],
          },
          rawRecords: [new TextEncoder().encode("Subject: Offline saved discussion\\n\\nRaw offline message")],
          saved: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastOpenedAt: "2026-01-01T00:00:00.000Z",
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });

  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("link", { name: /Offline saved discussion/ }).click();
  await expect(page.getByText("This message was read from IndexedDB.")).toBeVisible();
  await expect(page.getByText(/available offline/)).toBeVisible();
  await page.getByRole("button", { name: "Raw message" }).click();
  await expect(page.getByText("Raw offline message")).toBeVisible();
});

test("renders the generated 500-message projection within the DOM budget", async ({ page }) => {
  await page.goto("./#/saved");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("lorefold", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("threads", { keyPath: "thread.id" });
        store.createIndex("saved", "saved");
        store.createIndex("lastOpenedAt", "lastOpenedAt");
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const messages = Object.fromEntries(Array.from({ length: 500 }, (_, index) => {
          const id = `generated-${index}`;
          return [id, {
            id,
            messageId: `<${id}@example.test>`,
            references: [],
            missingAncestorIds: [],
            author: { name: `Author ${index}` },
            timestamp: { valid: false },
            subject: `Generated message ${index}`,
            mailingLists: [],
            blocks: [{ kind: "paragraph", text: `Generated body ${index}.` }],
            patchIds: [],
            attachmentMetadata: [],
            sourceOrdinal: index,
            diagnostics: [],
          }];
        }));
        const transaction = request.result.transaction("threads", "readwrite");
        transaction.objectStore("threads").put({
          thread: {
            schemaVersion: 1,
            id: "generated-stress-thread",
            source: { kind: "local-file", importedFilename: "stress.eml", contentDigest: "stress" },
            subject: "Generated stress thread",
            messages,
            rootIds: Object.keys(messages),
            childrenByParent: {},
            chronologicalIds: Object.keys(messages),
            patchSeries: [],
            diagnostics: [],
          },
          saved: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastOpenedAt: "2026-01-01T00:00:00.000Z",
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  const started = Date.now();
  await page.reload();
  await page.getByRole("link", { name: /Generated stress thread/ }).click();
  await expect(page.locator(".message-article")).toHaveCount(500);
  expect(Date.now() - started).toBeLessThan(1000);
  expect(await page.evaluate(() => document.documentElement.outerHTML.length)).toBeLessThan(50 * 1024 * 1024);
});
