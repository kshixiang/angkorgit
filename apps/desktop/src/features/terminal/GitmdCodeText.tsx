import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, FileCode2, Search } from 'lucide-react';
import { cn } from '@gitmd/design-system';
import { openExternal } from '@/core/ipc';
import { useGraph } from '@/features/graph/store';
import { useUi } from '@/features/ui/store';
import { parseGitmdCodeTable } from './gitmdCodeMarkdown';
import {
  classifyGitmdCodeReference,
  parseGitmdCodeOutputParts,
  type GitmdCodeReference,
} from './gitmdCodeReferences';

interface GitmdCodeTextProps {
  text: string;
  repoPath: string;
  knownFiles: ReadonlySet<string>;
  className?: string;
}

interface GitmdFileLinkProps {
  displayPath: string;
  path: string;
  className?: string;
}

const FENCED_CODE = /```([^\n`]*)\n([\s\S]*?)```/g;
const INLINE_MARKDOWN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\))/g;

function renderInlineMarkdown(
  value: string,
  keyPrefix: string,
  renderCode: (code: string, key: string) => ReactNode,
  renderLink: (label: string, url: string, key: string) => ReactNode,
): ReactNode[] {
  return value.split(INLINE_MARKDOWN).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') || part.startsWith('__')) {
      return <strong key={key} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('~~')) return <del key={key}>{part.slice(2, -2)}</del>;
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`')) return renderCode(part.slice(1, -1), key);
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) return renderLink(link[1], link[2], key);
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function GitmdFileLink({
  displayPath,
  path,
  className,
}: GitmdFileLinkProps) {
  const openDiff = () => {
    useGraph.getState().select(null);
    const ui = useUi.getState();
    ui.selectFile({ path, staged: false });
    ui.openCenterDiff({ path, staged: false, keepOpen: true });
  };

  return (
    <button
      type="button"
      className={cn(
        'inline-flex max-w-full items-baseline gap-1 rounded bg-primary/10 px-1 py-px font-mono text-[0.9em] text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
        className,
      )}
      title="Open file diff in GitMD"
      aria-label={`Open diff for ${path} in GitMD`}
      onClick={openDiff}
    >
      <FileCode2 className="size-3 shrink-0 self-center" />
      <span className="[overflow-wrap:anywhere]">{displayPath}</span>
    </button>
  );
}

function ReferenceLink({
  reference,
  display,
  repoPath,
}: {
  reference: GitmdCodeReference;
  display: string;
  repoPath: string;
}) {
  if (reference.kind === 'file') {
    return (
      <GitmdFileLink
        displayPath={display}
        path={reference.path}
      />
    );
  }
  if (reference.kind === 'url') {
    return (
      <button
        type="button"
        className="inline-flex max-w-full items-baseline gap-1 text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        title="Open link"
        onClick={() => void openExternal(reference.value)}
      >
        <span className="[overflow-wrap:anywhere]">{display}</span>
        <ExternalLink className="size-3 shrink-0 self-center" />
      </button>
    );
  }
  const searchCommit = () => {
    useUi.getState().focusGraphSearch();
    void useGraph.getState().setFind(repoPath, { text: reference.value, author: '' });
  };
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded bg-surface-raised px-1 py-px font-mono text-[0.9em] text-foreground hover:bg-border-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      title="Search commit in GitMD"
      aria-label={`Search commit ${reference.value} in GitMD`}
      onClick={searchCommit}
    >
      {display}
      <Search className="size-3 text-faint" />
    </button>
  );
}

export function GitmdCodeText({ text, repoPath, knownFiles, className }: GitmdCodeTextProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const blocks = useMemo(() => {
    const result: Array<{ kind: 'text'; value: string } | { kind: 'code'; value: string; language: string }> = [];
    let cursor = 0;
    for (const match of text.matchAll(FENCED_CODE)) {
      const index = match.index ?? 0;
      if (index > cursor) result.push({ kind: 'text', value: text.slice(cursor, index) });
      result.push({ kind: 'code', language: match[1].trim(), value: match[2] });
      cursor = index + match[0].length;
    }
    if (cursor < text.length) result.push({ kind: 'text', value: text.slice(cursor) });
    return result;
  }, [text]);

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  const copy = (value: string, key: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedKey(key);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedKey(null), 1400);
  };

  const renderReference = (reference: GitmdCodeReference, display: string, key: string): ReactNode => (
    <ReferenceLink
      key={key}
      reference={reference}
      display={display}
      repoPath={repoPath}
    />
  );

  const renderCode = (code: string, key: string) => {
    const reference = classifyGitmdCodeReference(code, repoPath, knownFiles);
    if (reference) return renderReference(reference, code, key);
    return (
      <button key={key} type="button" className="inline-flex items-center gap-1 rounded bg-surface-raised px-1 py-px font-mono text-[0.9em] text-foreground hover:bg-border-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" title="Copy code" onClick={() => copy(code, `code:${key}`)}>
        {code}
        {copiedKey === `code:${key}` ? <Check className="size-3 text-success" /> : <Copy className="size-3 text-faint" />}
      </button>
    );
  };

  const renderText = (value: string, keyPrefix: string) =>
    value.split('\n').map((line, lineIndex) => {
      const lineKey = `${keyPrefix}-line-${lineIndex}`;
      const parts = parseGitmdCodeOutputParts(line, repoPath, knownFiles);
      const content = parts.flatMap((part, partIndex) => part.reference
        ? [renderReference(part.reference, part.text, `${lineKey}-ref-${partIndex}`)]
        : renderInlineMarkdown(part.text, `${lineKey}-${partIndex}`, renderCode, (label, url, key) => (
          <button key={key} type="button" className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary" title="Open link" onClick={() => void openExternal(url)}>
            {label}
          </button>
        )));
      return <Fragment key={lineKey}>{lineIndex > 0 && <br />}{content}</Fragment>;
    });

  const renderMarkdown = (value: string, keyPrefix: string) => {
    const lines = value.split('\n');
    const elements: ReactNode[] = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      const table = parseGitmdCodeTable(lines, index);
      if (table) {
        const { header: headerCells, alignments, rows, nextLine } = table;
        index = nextLine;
        const renderCell = (cell: string, cellKey: string) => renderText(cell, cellKey);
        elements.push(
          <div key={`${keyPrefix}-table-${index}`} className="my-2 max-w-full overflow-x-auto rounded border border-border-subtle">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface-raised text-foreground">
                <tr>{headerCells.map((cell, cellIndex) => (
                  <th key={cellIndex} scope="col" className="border-b border-border-subtle px-2 py-1.5 font-semibold" style={{ textAlign: alignments[cellIndex] }}>
                    {renderCell(cell, `${keyPrefix}-table-head-${index}-${cellIndex}`)}
                  </th>
                ))}</tr>
              </thead>
              <tbody>{rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="even:bg-surface-raised/50">
                  {headerCells.map((_, cellIndex) => (
                    <td key={cellIndex} className="border-t border-border-subtle px-2 py-1.5 align-top" style={{ textAlign: alignments[cellIndex] }}>
                      {renderCell(row[cellIndex] ?? '', `${keyPrefix}-table-${index}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>,
        );
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const Tag = `h${heading[1].length}` as keyof JSX.IntrinsicElements;
        elements.push(<Tag key={`${keyPrefix}-heading-${index}`} className="mt-3 mb-1 font-semibold text-foreground">{renderText(heading[2], `${keyPrefix}-heading-${index}`)}</Tag>);
        index += 1; continue;
      }
      if (/^\s*[-*_](?:\s*[-*_]){2,}\s*$/.test(line)) {
        elements.push(<hr key={`${keyPrefix}-rule-${index}`} className="my-2 border-border-subtle" />); index += 1; continue;
      }
      const list = line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
      if (list) {
        const ordered = /^\d/.test(list[1]);
        const items: ReactNode[] = [];
        while (index < lines.length) {
          const item = lines[index].match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
          if (!item || /^\d/.test(item[1]) !== ordered) break;
          items.push(<li key={`${keyPrefix}-item-${index}`}>{renderText(item[2], `${keyPrefix}-item-${index}`)}</li>); index += 1;
        }
        const List = ordered ? 'ol' : 'ul';
        elements.push(<List key={`${keyPrefix}-list-${index}`} className={cn('my-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>{items}</List>); continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = line.replace(/^>\s?/, '');
        elements.push(<blockquote key={`${keyPrefix}-quote-${index}`} className="my-1 border-l-2 border-primary/40 pl-3 text-muted">{renderText(quote, `${keyPrefix}-quote-${index}`)}</blockquote>); index += 1; continue;
      }
      const paragraph: string[] = [line]; index += 1;
      while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+|^\s*([-*+]|\d+[.)])\s+|^>\s?|^\s*[-*_](?:\s*[-*_]){2,}\s*$/.test(lines[index])) paragraph.push(lines[index++]);
      elements.push(<p key={`${keyPrefix}-p-${index}`} className="my-1">{paragraph.map((part, partIndex) => <Fragment key={partIndex}>{partIndex > 0 && <br />}{renderText(part, `${keyPrefix}-p-${index}-${partIndex}`)}</Fragment>)}</p>);
    }
    return elements;
  };

  return (
    <div className={cn('min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] font-sans', className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'text') return <Fragment key={index}>{renderMarkdown(block.value, `text-${index}`)}</Fragment>;
        const copyKey = `block:${index}`;
        return (
          <div key={index} className="my-2 overflow-hidden rounded-md border border-border-subtle bg-background">
            <div className="flex h-7 items-center border-b border-border-subtle bg-surface-raised px-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-faint">
                {block.language || 'code'}
              </span>
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center rounded text-faint hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                title="Copy code block"
                aria-label="Copy code block"
                onClick={() => copy(block.value, copyKey)}
              >
                {copiedKey === copyKey ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              </button>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre p-2 font-mono text-[11px] leading-5 text-muted">
              <code>{block.value}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
}
