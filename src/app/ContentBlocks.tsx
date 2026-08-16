export interface TextContentBlocksProps {
  text: string;
}

export function ContentBlocks({ text }: TextContentBlocksProps) {
  const paragraphs = text.split(/\r?\n(?:[ \t]*\r?\n)+/u).filter((paragraph) => paragraph !== "");
  return (
    <div className="message-content">
      {paragraphs.length === 0 ? <p>(No readable text body.)</p> : paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`}>{displayText(paragraph)}</p>
      ))}
    </div>
  );
}
import { displayText } from "../security/display-text";
