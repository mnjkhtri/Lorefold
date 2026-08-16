import type { Patch } from "../models/patch";

export function PatchView({ patch }: { patch: Patch }) {
  return (
    <section className="patch-view" aria-labelledby={`${patch.id}-title`}>
      <header>
        <h2 id={`${patch.id}-title`}>{patch.subject || "Patch"}</h2>
        <p>{patch.statistics.files} files · +{patch.statistics.additions} · -{patch.statistics.deletions}</p>
      </header>
      {patch.files.map((file) => (
        <details className="patch-file" key={file.displayPath}>
          <summary>{file.displayPath} ({file.status})</summary>
          {file.binary ? (
            <p>Binary file; textual diff is unavailable.</p>
          ) : file.hunks.length === 0 ? (
            <p>No textual hunks.</p>
          ) : file.hunks.map((hunk) => (
            <details className="patch-hunk" key={hunk.header}>
              <summary>{hunk.header}</summary>
              <pre>
                {hunk.lines.map((line, index) => (
                  <code className={`diff-line diff-line--${line.kind}`} key={index}>
                    {line.text}{"\n"}
                  </code>
                ))}
              </pre>
            </details>
          ))}
        </details>
      ))}
      {patch.diagnostics.length > 0 && <p role="status">Some patch structure could not be interpreted; raw text is retained.</p>}
    </section>
  );
}
