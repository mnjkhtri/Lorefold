import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThreadOverview } from "../../src/app/ThreadOverview";

describe("ThreadOverview", () => {
  it("caps deep indentation", () => {
    const messages: Record<string, { id: string; subject: string }> = {};
    const childrenByParent: Record<string, string[]> = {};
    let parent: string | undefined;
    for (let index = 0; index < 30; index += 1) {
      const id = `message-${index}`;
      messages[id] = { id, subject: `Subject ${index}` };
      if (parent !== undefined) childrenByParent[parent] = [id];
      parent = id;
    }
    const html = renderToStaticMarkup(
      <ThreadOverview messages={messages} rootIds={["message-0"]} childrenByParent={childrenByParent} />,
    );
    expect(html).toContain("--thread-depth:6");
  });

  it("reports collapsed descendants", () => {
    const html = renderToStaticMarkup(
      <ThreadOverview
        messages={{ root: { id: "root", subject: "Root" }, child: { id: "child", subject: "Child" } }}
        rootIds={["root"]}
        childrenByParent={{ root: ["child"] }}
        collapsedIds={new Set(["root"])}
      />,
    );
    expect(html).toContain("1 replies collapsed");
    expect(html).not.toContain("Subject Child");
  });
});
