/** Short unified-style preview for permission dialogs (not a full Myers diff). */
export function formatBriefFileDiff(before: string, after: string, maxLines = 56): string {
  if (before === after) {
    return '(No textual changes — identical content.)';
  }

  const aLines = before.split('\n');
  const bLines = after.split('\n');
  let prefix = 0;
  const maxPrefix = Math.min(aLines.length, bLines.length);
  while (prefix < maxPrefix && aLines[prefix] === bLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < aLines.length - prefix &&
    suffix < bLines.length - prefix &&
    aLines[aLines.length - 1 - suffix] === bLines[bLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const aMid = aLines.slice(prefix, Math.max(prefix, aLines.length - suffix));
  const bMid = bLines.slice(prefix, Math.max(prefix, bLines.length - suffix));

  const header = [
    `Existing: ${aLines.length} lines, ${before.length} chars`,
    `Proposed: ${bLines.length} lines, ${after.length} chars`,
    `First mismatch at line ~${prefix + 1} (1-based).`,
    ''
  ].join('\n');

  const ctx = 4;
  const aStart = Math.max(0, prefix - ctx);
  const bStart = Math.max(0, prefix - ctx);
  const aSlice = aLines.slice(aStart, aStart + maxLines);
  const bSlice = bLines.slice(bStart, bStart + maxLines);

  const blockA = aSlice.map((line, i) => `${String(aStart + i + 1).padStart(5)} | ${line}`).join('\n');
  const blockB = bSlice.map((line, i) => `${String(bStart + i + 1).padStart(5)} | ${line}`).join('\n');

  const midNote =
    aMid.length > 0 || bMid.length > 0
      ? `\n--- changed region (trimmed) ---\n- removed ~${aMid.length} line(s)\n+ added ~${bMid.length} line(s)\n`
      : '';

  const out = `${header}\n--- existing (excerpt) ---\n${blockA}\n\n--- proposed (excerpt) ---\n${blockB}${midNote}`;
  return out.length > 12_000 ? `${out.slice(0, 12_000)}\n… (truncated)` : out;
}
