import { useEffect } from 'react';

interface KeyboardOptions {
  onClose?: () => void;
  onSearch?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  onPaste?: () => void;
  /** Quick paste: 1-based index of the visible card (Ctrl+1 -> 0). */
  onPasteIndex?: (index: number) => void;
}

/**
 * True when the event originates from a text field, so single-key shortcuts
 * (digits, "p") must not hijack what the user is typing.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
  }
  return false;
}

export function useKeyboard(options: KeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = isEditableTarget(e.target);

      // Ctrl+1..9 pastes the Nth card directly, without moving the selection first.
      if (
        options.onPasteIndex &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        !typing &&
        /^[1-9]$/.test(e.key)
      ) {
        e.preventDefault();
        options.onPasteIndex(Number(e.key) - 1);
        return;
      }

      if (e.key === 'Escape' && options.onClose) {
        e.preventDefault();
        options.onClose();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && options.onSearch) {
        e.preventDefault();
        options.onSearch();
      }

      if (e.key === 'Delete' && options.onDelete) {
        e.preventDefault();
        options.onDelete();
      }

      if (e.key === 'p' && !e.metaKey && !e.ctrlKey && !typing && options.onPin) {
        e.preventDefault();
        options.onPin();
      }

      if (e.key === 'ArrowLeft' && options.onNavigateLeft) {
        e.preventDefault();
        options.onNavigateLeft();
      }

      if (e.key === 'ArrowRight' && options.onNavigateRight) {
        e.preventDefault();
        options.onNavigateRight();
      }

      if (e.key === 'Enter' && options.onPaste) {
        e.preventDefault();
        options.onPaste();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [options]);
}
