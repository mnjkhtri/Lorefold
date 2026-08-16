import type { ContentBlock } from "../models/content";
import { displayText } from "../security/display-text";

export function RichContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="rich-content-blocks">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "paragraph":
            return <p key={index}>{displayText(block.text)}</p>;
          case "code":
            return <pre key={index}>{displayText(block.text)}</pre>;
          case "patch":
            return <p key={index}>Patch: {displayText(block.patchId)}</p>;
          case "quote":
            return (
              <details key={index} className="content-disclosure">
                <summary>Quoted context ({block.lineCount} lines, depth {block.maximumDepth})</summary>
                {block.attribution !== undefined && <p>{displayText(block.attribution)}</p>}
                <blockquote>
                  {block.lines.map((line, lineIndex) => (
                    <p key={lineIndex} data-quote-depth={line.depth}>{displayText(line.text)}</p>
                  ))}
                </blockquote>
              </details>
            );
          case "signature":
            return (
              <details key={index} className="content-disclosure">
                <summary>Signature ({block.lineCount} lines)</summary>
                <pre>{displayText(block.text)}</pre>
              </details>
            );
          default:
            return assertNever(block);
        }
      })}
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled content block: ${String(value)}`);
}
