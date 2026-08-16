import { HashRouter, Route, Routes } from "react-router-dom";

import { LatestPage } from "./LatestPage";
import { ChannelPage } from "./ChannelPage";
import { ThreadPage } from "./ThreadPage";
import { UpdatePrompt } from "./UpdatePrompt";

export function AppContent() {
  return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header__inner">
            <a className="app-brand" href="#/" aria-label="Lorefold home">Lorefold</a>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<LatestPage />} />
            <Route path="/channel/:channel" element={<ChannelPage />} />
            <Route path="/thread/:key" element={<ThreadPage />} />
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
