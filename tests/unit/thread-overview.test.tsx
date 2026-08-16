import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThreadOverview } from "../../src/app/ThreadOverview";

describe("ThreadOverview", () => {
  it("caps deep indentation and shows reply context", () => {
    const messages: Record<string, { id: string; author: string; subject: string; parentId?: string }> = {};
    const childrenByParent: Record<string, string[]> = {};
    let parent: string | undefined;
    for (let index = 0; index < 30; index += 1) {
      const id = `message-${index}`;
      messages[id] = { id, author: `Author ${index}`, subject: `Subject ${index}`, ...(parent === undefined ? {} : { parentId: parent }) };
      if (parent !== undefined) childrenByParent[parent] = [id];
      parent = id;
    }
    const html = renderToStaticMarkup(
      <ThreadOverview messages={messages} rootIds={["message-0"]} childrenByParent={childrenByParent} />,
    );
    expect(html).toContain("Reply to Author 0");
    expect(html).toContain("--thread-depth:6");
  });

  it("reports collapsed descendants", () => {
    const html = renderToStaticMarkup(
      <ThreadOverview
        messages={{ root: { id: "root", author: "Root", subject: "Root" }, child: { id: "child", author: "Child", subject: "Child", parentId: "root" } }}
        rootIds={["root"]}
        childrenByParent={{ root: ["child"] }}
        collapsedIds={new Set(["root"])}
      />,
    );
    expect(html).toContain("1 replies collapsed");
    expect(html).not.toContain("Subject Child");
  });
});
