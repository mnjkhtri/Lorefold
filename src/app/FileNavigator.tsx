import type { DiffFile } from "../models/patch";

export function FileNavigator({ files, activePath }: { files: DiffFile[]; activePath?: string }) {
  return (
    <nav className="file-navigator" aria-label="Patch files">
      <h2>Files</h2>
      <ol>
        {files.map((file) => (
          <li key={file.displayPath}>
            <a
              href={`#file-${encodeURIComponent(file.displayPath)}`}
              aria-current={file.displayPath === activePath ? "page" : undefined}
            >
              {file.displayPath} <span>({file.status})</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
