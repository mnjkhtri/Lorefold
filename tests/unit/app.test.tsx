import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppContent } from "../../src/app/App";

describe("App", () => {
  it("renders the initial heading", () => {
    expect(renderToStaticMarkup(<MemoryRouter><AppContent /></MemoryRouter>)).toContain(
      '<h1 id="latest-title">latest activity</h1>',
    );
  });
});
