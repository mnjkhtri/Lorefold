import type { CSSProperties, ReactElement } from "react";
import type { MessageKey } from "../models/thread";

export interface OverviewMessage {
  id: MessageKey;
  author: string;
  subject: string;
  parentId?: MessageKey;
}

interface ThreadOverviewProps {
  messages: Record<MessageKey, OverviewMessage>;
  rootIds: MessageKey[];
  childrenByParent: Record<MessageKey, MessageKey[]>;
  collapsedIds?: ReadonlySet<MessageKey>;
}

export function ParentPreview({ message }: { message: OverviewMessage }) {
  return <p className="parent-preview">Reply to {message.author}: {message.subject}</p>;
}

export function ThreadOverview({ messages, rootIds, childrenByParent, collapsedIds = new Set() }: ThreadOverviewProps) {
  const renderNode = (id: MessageKey, depth: number): ReactElement => {
    const message = messages[id];
    const children = childrenByParent[id] ?? [];
    const collapsed = collapsedIds.has(id);
    return (
      <li key={id} className="overview-node" style={{ "--thread-depth": Math.min(depth, 6) } as CSSProperties}>
        <a href={`#message-${encodeURIComponent(id)}`}>{message.subject || "(no subject)"}</a>
        {message.parentId !== undefined && <ParentPreview message={messages[message.parentId]} />}
        {children.length > 0 && !collapsed && <ol>{children.map((child) => renderNode(child, depth + 1))}</ol>}
        {children.length > 0 && collapsed && <span className="branch-count">{children.length} replies collapsed</span>}
      </li>
    );
  };

  return (
    <nav className="thread-overview" aria-label="Thread overview">
      <h2>Thread</h2>
      <ol>{rootIds.map((id) => renderNode(id, 0))}</ol>
    </nav>
  );
}
