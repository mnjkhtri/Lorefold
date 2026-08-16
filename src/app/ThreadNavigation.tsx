export interface ThreadNavigationProps {
  previousId?: string;
  nextId?: string;
  parentId?: string;
  nextReplyId?: string;
  collapsed: boolean;
  descendantCount: number;
  onToggleBranch: () => void;
}

function target(id: string | undefined): string | undefined {
  return id === undefined ? undefined : `#message-${encodeURIComponent(id)}`;
}

export function ThreadNavigation(props: ThreadNavigationProps) {
  return (
    <nav className="thread-navigation" aria-label="Thread navigation">
      {props.previousId !== undefined && <a href={target(props.previousId)} rel="prev">Previous</a>}
      {props.nextId !== undefined && <a href={target(props.nextId)} rel="next">Next</a>}
      {props.parentId !== undefined && <a href={target(props.parentId)}>Parent</a>}
      {props.nextReplyId !== undefined && <a href={target(props.nextReplyId)}>Next reply</a>}
      <button type="button" onClick={props.onToggleBranch} aria-expanded={!props.collapsed}>
        {props.collapsed ? `Show ${props.descendantCount} replies` : "Collapse replies"}
      </button>
    </nav>
  );
}
