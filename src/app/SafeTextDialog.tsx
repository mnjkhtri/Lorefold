import { useEffect, useRef, useState } from "react";

export interface SafeTextDialogProps {
  label: string;
  title: string;
  text?: string;
  emptyMessage: string;
}

export function SafeTextDialog({ label, title, text, emptyMessage }: SafeTextDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const copy = async (): Promise<void> => {
    if (text === undefined || !navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} disabled={text === undefined}>
        {label}
      </button>
      <dialog ref={dialogRef} aria-labelledby={`${label}-dialog-title`} onCancel={close} onClose={() => setOpen(false)}>
        <h2 id={`${label}-dialog-title`}>{title}</h2>
        <pre>{text ?? emptyMessage}</pre>
        {text !== undefined && <button type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>}
        <button type="button" onClick={close}>Close</button>
      </dialog>
    </>
  );
}
