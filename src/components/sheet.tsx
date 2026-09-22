"use client";
import { useContext, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Context } from "./context";
export function Sheet({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const feedback = useContext(Context)?.feedback;
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientY < r.top ||
            e.clientY > r.bottom ||
            e.clientX < r.left ||
            e.clientX > r.right
          )
            onClose();
        }
      }}
    >
      <div className="sheet-grip" />
      <div className="sheet-heading">
        <h2>{title}</h2>
        <button
          className="icon-button close"
          aria-label="关闭"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
      {feedback && (
        <div className="sheet-feedback" role="status">
          {feedback}
        </div>
      )}
    </dialog>
  );
}
