import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ThreadNavigation } from "../../src/app/ThreadNavigation";

describe("ThreadNavigation", () => {
  it("renders available deterministic targets and branch state", () => {
    const html = renderToStaticMarkup(
      <ThreadNavigation
        previousId="a"
        nextId="b"
        parentId="root"
        nextReplyId="reply"
        collapsed
        descendantCount={3}
        onToggleBranch={() => undefined}
      />,
    );
    expect(html).toContain("#message-a");
    expect(html).toContain("#message-root");
    expect(html).toContain("Show 3 replies");
    expect(html).toContain('aria-expanded="false"');
  });
});
