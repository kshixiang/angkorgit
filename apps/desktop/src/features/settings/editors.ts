import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ipc, type EditorInfo } from '@/core/ipc';

let cache: Promise<EditorInfo[]> | null = null;
const listeners = new Set<(editors: EditorInfo[]) => void>();

export function loadEditors(force = false): Promise<EditorInfo[]> {
  if (force || !cache) {
    cache = ipc.editorsDetect().catch(() => []);
    void cache.then((editors) => listeners.forEach((fn) => fn(editors)));
  }
  return cache;
}

export function useEditors(): { editors: EditorInfo[]; loading: boolean; rescan: () => Promise<void> } {
  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const apply = (found: EditorInfo[]) => {
      if (cancelled) return;
      setEditors(found);
      setLoading(false);
    };
    listeners.add(apply);
    void loadEditors().then(apply);
    return () => {
      cancelled = true;
      listeners.delete(apply);
    };
  }, []);
  const rescan = async () => {
    setLoading(true);
    await loadEditors(true);
    setLoading(false);
  };
  return { editors, loading, rescan };
}

export function preferredEditor(editors: EditorInfo[], editorId: string | null): EditorInfo | null {
  return editors.find((editor) => editor.id === editorId) ?? editors[0] ?? null;
}

export async function openInEditor(editorId: string, target: string): Promise<void> {
  try {
    await ipc.editorOpen(editorId, target);
  } catch (error) {
    toast.error(`Could not open the editor: ${(error as { message?: string }).message ?? error}`);
    void loadEditors(true);
  }
}
