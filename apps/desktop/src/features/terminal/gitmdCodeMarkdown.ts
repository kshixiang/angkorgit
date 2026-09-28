function tableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return Boolean(cells?.length && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

export function parseGitmdCodeTable(lines: readonly string[], start: number) {
  const header = tableCells(lines[start] ?? '');
  const separator = lines[start + 1];
  const separatorCells = separator === undefined ? null : tableCells(separator);
  if (!header || !separatorCells || !isTableSeparator(separator) || header.length !== separatorCells.length) return null;

  const alignments = separatorCells.map((cell) => cell.startsWith(':')
    ? (cell.endsWith(':') ? 'center' : 'left')
    : (cell.endsWith(':') ? 'right' : undefined));
  const rows: string[][] = [];
  let nextLine = start + 2;
  while (nextLine < lines.length) {
    const cells = tableCells(lines[nextLine]);
    if (!cells) break;
    rows.push(cells);
    nextLine += 1;
  }
  return { header, alignments, rows, nextLine };
}
