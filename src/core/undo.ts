export interface UndoAction {
  id: string;
  title: string;
  do?: () => Promise<void> | void;
  undo: () => Promise<void> | void;
  timestamp: number;
}

class UndoManager {
  private stack: UndoAction[] = [];
  private maxActions: number = 20;
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error(e);
      }
    }
  }

  push(action: Omit<UndoAction, 'id' | 'timestamp'>): void {
    const fullAction: UndoAction = {
      ...action,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    this.stack.push(fullAction);
    if (this.stack.length > this.maxActions) {
      this.stack.shift();
    }
    this.notify();
  }

  getRecentAction(): UndoAction | undefined {
    return this.stack[this.stack.length - 1];
  }

  async undoLatest(): Promise<boolean> {
    const action = this.stack.pop();
    if (!action) return false;
    this.notify();
    try {
      await action.undo();
      return true;
    } catch (err) {
      console.error('Failed to undo action:', err);
      return false;
    }
  }

  clear(): void {
    this.stack = [];
    this.notify();
  }

  size(): number {
    return this.stack.length;
  }
}

export const undoManager = new UndoManager();

/**
 * Global keyboard listener helper
 */
export function setupUndoKeyboardListener(): () => void {
  const handler = (e: KeyboardEvent) => {
    // Check if Ctrl+Z or Cmd+Z
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('contenteditable') === 'true';

      if (!isInput) {
        e.preventDefault();
        undoManager.undoLatest();
      }
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
