import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppContent } from "../../src/app/App";

describe("static scaffold", () => {
  it("renders a semantic main landmark", () => {
    expect(renderToStaticMarkup(<MemoryRouter><AppContent /></MemoryRouter>)).toContain(
      '<main class="app-main">',
    );
  });
});
