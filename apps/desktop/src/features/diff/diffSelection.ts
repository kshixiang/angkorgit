import { useEffect, useLayoutEffect, useRef } from 'react';
import type { DiffLine } from '@angkorgit/core';
import type { FlatRow } from './VirtualDiff';

interface Endpoint {
  layer: HTMLElement;
  row: number;
  offset: number;
}

interface LogicalSelection {
  anchor: Endpoint;
  focus: Endpoint;
}

interface Boundary {
  node: Node;
  offset: number;
}

interface Signature {
  anchor: Boundary;
  focus: Boundary;
}

interface Applied {
  desired: Signature;
  actual: Signature;
}

type Located = { kind: 'row'; endpoint: Endpoint } | { kind: 'layer' } | { kind: 'outside' };

const LAYER_SELECTOR = '[data-diff-layer]';
const ROW_SELECTOR = '[data-diff-row]';
const START_SENTINEL = '[data-diff-sentinel="start"]';
const END_SENTINEL = '[data-diff-sentinel="end"]';

const readers = new WeakMap<HTMLElement, () => string | null>();

export function diffSelectionText(scroller: HTMLElement | null): string | null {
  if (!scroller) return null;
  return readers.get(scroller)?.() ?? null;
}

function elementOf(node: Node | null): Element | null {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
}

function locate(node: Node | null, offset: number, root: HTMLElement): Located {
  const el = elementOf(node);
  if (!node || !el || !root.contains(node)) return { kind: 'outside' };
  const layer = el.closest<HTMLElement>(LAYER_SELECTOR);
  if (!layer) return { kind: 'outside' };
  const rowEl = el.closest<HTMLElement>(ROW_SELECTOR);
  if (!rowEl || !layer.contains(rowEl)) return { kind: 'layer' };
  const range = document.createRange();
  range.setStart(rowEl, 0);
  range.setEnd(node, offset);
  return {
    kind: 'row',
    endpoint: { layer, row: Number(rowEl.dataset.diffRow), offset: range.toString().length },
  };
}

function textPosition(rowEl: HTMLElement, offset: number): Boundary {
  const walker = document.createTreeWalker(rowEl, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (remaining <= node.length) return { node, offset: remaining };
    remaining -= node.length;
    last = node;
  }
  if (last) return { node: last, offset: last.length };
  return { node: rowEl, offset: 0 };
}

type Projection = Boundary | 'before' | 'after';

function project(endpoint: Endpoint): Projection {
  const { layer, row, offset } = endpoint;
  const children = layer.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!(child instanceof HTMLElement) || child.dataset.diffRow === undefined) continue;
    const index = Number(child.dataset.diffRow);
    if (index === row) return textPosition(child, offset);
    if (index > row) return 'before';
  }
  return 'after';
}

function sentinelText(layer: HTMLElement, selector: string): Text | null {
  const node = layer.querySelector(selector)?.firstChild;
  return node instanceof Text && node.length > 0 ? node : null;
}

function resolve(
  selection: LogicalSelection,
): { anchor: Boundary; focus: Boundary } | null {
  const anchorProjection = project(selection.anchor);
  const focusProjection = project(selection.focus);
  const bothOnSentinel =
    typeof anchorProjection === 'string' && anchorProjection === focusProjection;
  const anchorFirst =
    selection.anchor.row < selection.focus.row ||
    (selection.anchor.row === selection.focus.row &&
      selection.anchor.offset <= selection.focus.offset);
  const settle = (projection: Projection, layer: HTMLElement, isAnchor: boolean): Boundary | null => {
    if (typeof projection !== 'string') return projection;
    const text = sentinelText(layer, projection === 'before' ? START_SENTINEL : END_SENTINEL);
    if (!text) return null;
    if (!bothOnSentinel) return { node: text, offset: projection === 'before' ? 0 : text.length };
    const first = isAnchor ? anchorFirst : !anchorFirst;
    return { node: text, offset: first ? 0 : text.length };
  };
  const anchor = settle(anchorProjection, selection.anchor.layer, true);
  const focus = settle(focusProjection, selection.focus.layer, false);
  return anchor && focus ? { anchor, focus } : null;
}

function matches(dom: Selection, signature: Signature): boolean {
  return (
    dom.anchorNode === signature.anchor.node &&
    dom.anchorOffset === signature.anchor.offset &&
    dom.focusNode === signature.focus.node &&
    dom.focusOffset === signature.focus.offset
  );
}

function sameSignature(a: Signature, b: Signature): boolean {
  return (
    a.anchor.node === b.anchor.node &&
    a.anchor.offset === b.anchor.offset &&
    a.focus.node === b.focus.node &&
    a.focus.offset === b.focus.offset
  );
}

function snapshot(dom: Selection): Signature | null {
  if (!dom.anchorNode || !dom.focusNode) return null;
  return {
    anchor: { node: dom.anchorNode, offset: dom.anchorOffset },
    focus: { node: dom.focusNode, offset: dom.focusOffset },
  };
}

function sameEndpoint(a: Endpoint, b: Endpoint): boolean {
  return a.layer === b.layer && a.row === b.row && a.offset === b.offset;
}

function lineOf(row: FlatRow | undefined, side: string | undefined): DiffLine | null {
  if (!row) return null;
  if (row.kind === 'line') return row.line;
  if (row.kind === 'pair') return side === 'old' ? row.left : row.right;
  return null;
}

export function selectedDiffText(rows: FlatRow[], selection: LogicalSelection): string | null {
  const { anchor, focus } = selection;
  if (anchor.layer !== focus.layer) return null;
  const backwards =
    focus.row < anchor.row || (focus.row === anchor.row && focus.offset < anchor.offset);
  const start = backwards ? focus : anchor;
  const end = backwards ? anchor : focus;
  const side = anchor.layer.closest<HTMLElement>('[data-diff-pane]')?.dataset.diffPane;
  const out: string[] = [];
  for (let i = start.row; i <= end.row; i++) {
    const line = lineOf(rows[i], side);
    if (!line) continue;
    let text = line.content;
    if (i === end.row) text = text.slice(0, end.offset);
    if (i === start.row) text = text.slice(start.offset);
    out.push(text);
  }
  return out.join('\n');
}

const isEditable = (el: Element | null): boolean =>
  !!el &&
  (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);

export function useStableSelection(
  rows: FlatRow[],
  scrollRef: React.RefObject<HTMLDivElement>,
): void {
  const logical = useRef<LogicalSelection | null>(null);
  const applied = useRef<Applied | null>(null);
  const dragging = useRef(false);
  const rowsRef = useRef(rows);

  useLayoutEffect(() => {
    if (rowsRef.current !== rows) {
      rowsRef.current = rows;
      logical.current = null;
      applied.current = null;
      return;
    }
    const selection = logical.current;
    const dom = window.getSelection();
    const root = scrollRef.current;
    if (!selection || !dom || !root) return;
    if (!selection.anchor.layer.isConnected || !selection.focus.layer.isConnected) {
      logical.current = null;
      applied.current = null;
      return;
    }
    const resolved = resolve(selection);
    if (!resolved) return;
    let { focus } = resolved;
    const { anchor } = resolved;
    if (dragging.current && dom.focusNode && root.contains(dom.focusNode)) {
      focus = { node: dom.focusNode, offset: dom.focusOffset };
    }
    const desired = { anchor, focus };
    const previous = applied.current;
    if (previous && sameSignature(previous.desired, desired) && matches(dom, previous.actual)) return;
    if (matches(dom, desired)) {
      applied.current = { desired, actual: desired };
      return;
    }
    dom.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
    applied.current = { desired, actual: snapshot(dom) ?? desired };
  });

  useEffect(() => {
    const read = () => (logical.current ? selectedDiffText(rowsRef.current, logical.current) : null);

    const onSelectionChange = () => {
      const root = scrollRef.current;
      const dom = window.getSelection();
      if (!root || !dom) return;
      if (applied.current && matches(dom, applied.current.actual)) return;
      if (dom.rangeCount === 0) {
        logical.current = null;
        return;
      }
      const a = locate(dom.anchorNode, dom.anchorOffset, root);
      const f = locate(dom.focusNode, dom.focusOffset, root);
      if (a.kind === 'outside' || f.kind === 'outside') {
        logical.current = null;
        return;
      }
      if (dom.isCollapsed) return;
      if (a.kind === 'layer' && f.kind === 'layer') return;
      const previous = logical.current;
      const anchor = a.kind === 'row' ? a.endpoint : previous?.anchor ?? null;
      const focus = f.kind === 'row' ? f.endpoint : previous?.focus ?? null;
      if (!anchor || !focus || sameEndpoint(anchor, focus)) return;
      logical.current = { anchor, focus };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const root = scrollRef.current;
      if (!root || !(e.target instanceof Node) || !root.contains(e.target)) return;
      dragging.current = true;
      if (e.shiftKey) return;
      logical.current = null;
      applied.current = null;
    };
    const endDrag = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const dom = window.getSelection();
      if (dom && (dom.rangeCount === 0 || dom.isCollapsed)) {
        logical.current = null;
        applied.current = null;
      }
    };

    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(document.activeElement)) return;
      const text = read();
      if (text === null) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', text);
    };

    const root = scrollRef.current;
    if (root) readers.set(root, read);
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mouseup', endDrag, true);
    window.addEventListener('blur', endDrag);
    document.addEventListener('copy', onCopy);
    return () => {
      if (root && readers.get(root) === read) readers.delete(root);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mouseup', endDrag, true);
      window.removeEventListener('blur', endDrag);
      document.removeEventListener('copy', onCopy);
    };
  }, [scrollRef]);
}
