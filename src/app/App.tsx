import { HashRouter, Route, Routes } from "react-router-dom";

import { OpenPage } from "./OpenPage";
import { LatestPage } from "./LatestPage";
import { ThreadPage } from "./ThreadPage";
import { SavedPage } from "./SavedPage";
import { UpdatePrompt } from "./UpdatePrompt";

export function AppContent() {
  return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header__inner">
            <a className="app-brand" href="#/" aria-label="Lorefold home">Lorefold</a>
            <span className="app-header__status"><a href="#/saved">Saved</a> · Local-first archive reader</span>
            <details className="keyboard-help">
              <summary>Keyboard help</summary>
              <p>Use Tab to move between controls, Enter or Space to activate, and Escape to close dialogs.</p>
            </details>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<LatestPage />} />
            <Route path="/import" element={<OpenPage />} />
            <Route path="/thread/:key" element={<ThreadPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="*" element={<LatestPage />} />
          </Routes>
        </main>
        <UpdatePrompt />
      </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
