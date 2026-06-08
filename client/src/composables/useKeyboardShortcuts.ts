import { onMounted, onBeforeUnmount } from 'vue';

export interface ShortcutBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  handler: () => void;
}

const defaultBindings: Record<string, { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }> = {
  prevPage: { key: 'ArrowLeft' },
  nextPage: { key: 'ArrowRight' },
  toggleToc: { key: 't' },
  toggleBookmarks: { key: 'b' },
  addBookmark: { key: 'd' },
  fullscreen: { key: 'f' },
  zoomIn: { key: '=', ctrl: true },
  zoomOut: { key: '-', ctrl: true },
  closePanels: { key: 'Escape' },
};

export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  const userBindings = loadUserBindings();
  const bindings: ShortcutBinding[] = [];

  for (const [action, handler] of Object.entries(handlers)) {
    const binding = userBindings[action] || defaultBindings[action];
    if (binding) {
      bindings.push({ ...binding, action, handler });
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isInputFocused()) return;

    for (const binding of bindings) {
      if (matchesBinding(e, binding)) {
        e.preventDefault();
        binding.handler();
        return;
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
  });

  return { bindings, defaultBindings };
}

function matchesBinding(e: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (e.key.toLowerCase() !== binding.key.toLowerCase()) return false;
  if (!!binding.ctrl !== e.ctrlKey) return false;
  if (!!binding.shift !== e.shiftKey) return false;
  if (!!binding.alt !== e.altKey) return false;
  return true;
}

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function loadUserBindings(): Record<string, { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }> {
  try {
    const raw = localStorage.getItem('bookisle_keybindings');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUserBindings(bindings: Record<string, { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }>) {
  localStorage.setItem('bookisle_keybindings', JSON.stringify(bindings));
}
