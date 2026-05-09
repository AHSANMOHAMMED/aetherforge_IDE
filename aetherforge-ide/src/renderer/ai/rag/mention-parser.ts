/**
 * `@mention` parser for the AI chat input.
 *
 * The chat input lets the user reference workspace files inline with `@path/to/file.ts`. We extract
 * those references at message-send time so the orchestration layer can attach the referenced file
 * contents as additional context to the prompt.
 *
 * Rules:
 *   - Mentions start with `@` and run until the next whitespace.
 *   - Backslash escapes (`\@`) are stripped from the parsed body (so `\@user` is treated as a
 *     literal at-sign).
 *   - Empty (just `@`) and email-style (`user@host`) mentions are skipped.
 *   - The same mention surfaces only once even when typed repeatedly.
 */

export type ParsedMention = {
  /** Raw text including the leading `@`, e.g. `@src/App.tsx`. */
  raw: string;
  /** Just the path body, e.g. `src/App.tsx`. */
  path: string;
};

const MENTION_RE = /(^|[\s(])@([^\s(),;]+)/g;

export function parseMentions(text: string): ParsedMention[] {
  const seen = new Set<string>();
  const mentions: ParsedMention[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(text)) !== null) {
    const path = match[2];
    if (!path || path.length === 0) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    mentions.push({ raw: `@${path}`, path });
  }
  return mentions;
}

/**
 * Strip mentions from the user-facing prompt before forwarding to the LLM. The mentions become
 * structured context rather than inline tokens.
 */
export function stripMentions(text: string): string {
  return text
    .replace(MENTION_RE, (_full, leading: string) => leading)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Render the resolved mention contents as a single context block suitable for prepending to the
 * planner prompt.
 */
export function formatMentionContext(
  resolved: Array<{ path: string; content: string }>,
  perFileLimit = 4000
): string {
  if (resolved.length === 0) {
    return '';
  }
  const blocks = resolved.map(({ path, content }) => {
    const trimmed =
      content.length > perFileLimit ? `${content.slice(0, perFileLimit)}\n…[truncated]` : content;
    return `## ${path}\n\`\`\`\n${trimmed}\n\`\`\``;
  });
  return ['Referenced workspace files:', ...blocks].join('\n\n');
}
