import type { JSONContent } from "@tiptap/core";

// Reverses tiptap-to-markdown.ts: parses a Markdown string (as produced by
// our own .md/.zip export, and reasonably common plain Markdown too) back
// into a Tiptap `doc` node. Not a general-purpose CommonMark parser — it
// covers exactly the subset our exporter produces, on a best-effort basis for
// anything else.

type Mark = { type: string; attrs?: Record<string, unknown> };
// "footnoteRef" is a temporary placeholder, not the final Tiptap node shape —
// resolveFootnotes() (called once, at the top of markdownToTiptapDoc) walks
// the parsed tree and replaces each one with a real `footnoteReference` node
// (data-id + referenceNumber), since assigning those requires seeing the
// whole document first (order determines numbering, and the matching
// `[^label]: ...` definition may appear anywhere in the source).
type InlineNode =
  | { type: "text"; text: string; marks?: Mark[] }
  | { type: "hardBreak" }
  | { type: "inlineMath"; attrs: { latex: string } }
  | { type: "footnoteRef"; label: string };

function withMark(nodes: InlineNode[], mark: Mark): InlineNode[] {
  return nodes.map((node) =>
    node.type === "text" ? { ...node, marks: [...(node.marks ?? []), mark] } : node,
  );
}

// Ordered longest-pattern-first so e.g. "***x***" (bold+italic) is tried
// before "**x**" (bold) or "*x*" (italic) can partially match it.
const INLINE_RULES: Array<{
  re: RegExp;
  build: (m: RegExpMatchArray) => InlineNode[];
}> = [
  { re: /^\$([^$\n]+)\$/, build: (m) => [{ type: "inlineMath", attrs: { latex: m[1] } }] },
  { re: /^\[\^([^\]]+)\]/, build: (m) => [{ type: "footnoteRef", label: m[1] }] },
  {
    re: /^\*\*\*(.+?)\*\*\*/,
    build: (m) => withMark(withMark(parseInline(m[1]), { type: "bold" }), { type: "italic" }),
  },
  { re: /^\*\*(.+?)\*\*/, build: (m) => withMark(parseInline(m[1]), { type: "bold" }) },
  { re: /^~~(.+?)~~/, build: (m) => withMark(parseInline(m[1]), { type: "strike" }) },
  { re: /^<u>(.+?)<\/u>/, build: (m) => withMark(parseInline(m[1]), { type: "underline" }) },
  { re: /^`([^`]+)`/, build: (m) => [{ type: "text", text: m[1], marks: [{ type: "code" }] }] },
  {
    re: /^\[([^\]]*)\]\(([^)]+)\)/,
    build: (m) => withMark(parseInline(m[1]), { type: "link", attrs: { href: m[2] } }),
  },
  { re: /^\*(.+?)\*/, build: (m) => withMark(parseInline(m[1]), { type: "italic" }) },
  { re: /^ {2}\n/, build: () => [{ type: "hardBreak" }] },
];

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = text;
  let plain = "";

  const flushPlain = () => {
    if (plain) {
      nodes.push({ type: "text", text: plain });
      plain = "";
    }
  };

  while (rest.length > 0) {
    let matched = false;
    for (const rule of INLINE_RULES) {
      const m = rule.re.exec(rest);
      if (m) {
        flushPlain();
        nodes.push(...rule.build(m));
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += rest[0];
      rest = rest.slice(1);
    }
  }
  flushPlain();
  return nodes;
}

function inlineToTiptap(text: string): JSONContent[] {
  return parseInline(text) as unknown as JSONContent[];
}

// --- block splitting --------------------------------------------------------

function splitBlocks(markdown: string): string[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trimEnd())
    .filter((b) => b.trim().length > 0);
}

// Matches a footnote definition block as emitted by tiptap-to-markdown.ts's
// exporter: `[^1]: content` (single line — the exporter always collapses a
// footnote's content to one line, so that's the only shape parsed back).
const FOOTNOTE_DEF = /^\[\^([^\]]+)\]:\s*([\s\S]*)$/;

// Recursively walks a parsed content tree, replacing each "footnoteRef"
// placeholder (in document order) with a real `footnoteReference` node and
// collecting the matching `footnote` node (from `defs`, keyed by the
// original markdown label) into `footnotes`, out param via the closure.
function resolveFootnotes(
  nodes: JSONContent[],
  defs: Map<string, InlineNode[]>,
  footnotes: JSONContent[],
): JSONContent[] {
  return nodes.map((node) => {
    if ((node as unknown as InlineNode).type === "footnoteRef") {
      const label = (node as unknown as { label: string }).label;
      const id = crypto.randomUUID();
      const referenceNumber = String(footnotes.length + 1);
      const defContent = defs.get(label);
      footnotes.push({
        type: "footnote",
        attrs: { id: `fn:${referenceNumber}`, "data-id": id },
        content: [
          {
            type: "paragraph",
            content: defContent ? (defContent as unknown as JSONContent[]) : [],
          },
        ],
      });
      return {
        type: "footnoteReference",
        attrs: { "data-id": id, referenceNumber },
      } satisfies JSONContent;
    }
    if (Array.isArray(node.content)) {
      return { ...node, content: resolveFootnotes(node.content, defs, footnotes) };
    }
    return node;
  });
}

function stripIndent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
    .join("\n");
}

function parseListBlock(block: string, ordered: boolean): JSONContent {
  const lines = block.split("\n");
  const items: JSONContent[] = [];
  let current: string[] | null = null;

  const flush = () => {
    if (!current) return;
    const [first, ...contRest] = current;
    const marker = ordered ? /^\d+\.\s/ : /^[-*]\s/;
    const text = first.replace(marker, "");
    const nested = contRest.filter((l) => l.startsWith("  "));
    const itemContent: JSONContent[] = [{ type: "paragraph", content: inlineToTiptap(text) }];
    if (nested.length > 0) {
      const nestedText = nested.map((l) => l.slice(2)).join("\n");
      const isOrderedNested = /^\d+\.\s/.test(nestedText);
      itemContent.push(parseListBlock(nestedText, isOrderedNested));
    }
    items.push({ type: "listItem", content: itemContent });
    current = null;
  };

  for (const line of lines) {
    if (/^(\d+\.|[-*])\s/.test(line)) {
      flush();
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  flush();

  return { type: ordered ? "orderedList" : "bulletList", content: items };
}

function parseTaskListBlock(block: string): JSONContent {
  const items = block
    .split("\n")
    .filter((line) => /^- \[[ xX]]\s/.test(line))
    .map((line) => {
      const checked = /^- \[[xX]]/.test(line);
      const text = line.replace(/^- \[[ xX]]\s/, "");
      return {
        type: "taskItem",
        attrs: { checked },
        content: [{ type: "paragraph", content: inlineToTiptap(text) }],
      };
    });
  return { type: "taskList", content: items };
}

function parseTableBlock(block: string): JSONContent | null {
  const lines = block.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return null;
  const cellsOf = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());

  const header = cellsOf(lines[0]);
  const rows = lines.slice(2).map(cellsOf);

  const cell = (kind: string, text: string): JSONContent => ({
    type: kind,
    content: [{ type: "paragraph", content: text ? inlineToTiptap(text) : [] }],
  });

  const content: JSONContent[] = [
    { type: "tableRow", content: header.map((h) => cell("tableHeader", h)) },
    ...rows.map((row) => ({
      type: "tableRow",
      content: row.map((c) => cell("tableCell", c)),
    })),
  ];
  return { type: "table", content };
}

const CALLOUT_LABEL = /^\*\*([A-Z][A-Z0-9_-]*)(?::\s*(.+))?\*\*$/;

function parseBlockquoteBlock(block: string): JSONContent {
  const inner = stripIndent(block, "> ").replace(/^>$/gm, "");
  const innerBlocks = splitBlocks(inner);
  const firstLine = innerBlocks[0]?.trim();
  const calloutMatch = firstLine ? CALLOUT_LABEL.exec(firstLine) : null;

  if (calloutMatch) {
    const kind = calloutMatch[1].toLowerCase();
    const title = calloutMatch[2] ?? "";
    const bodyBlocks = innerBlocks.slice(1);
    return {
      type: "callout",
      attrs: { kind, title },
      content: bodyBlocks.map(parseBlock).filter((n): n is JSONContent => n !== null),
    };
  }

  return {
    type: "blockquote",
    content: innerBlocks.map(parseBlock).filter((n): n is JSONContent => n !== null),
  };
}

function parseBlock(block: string): JSONContent | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
  if (heading) {
    return {
      type: "heading",
      attrs: { level: heading[1].length },
      content: inlineToTiptap(heading[2]),
    };
  }

  if (/^```/.test(trimmed)) {
    const lines = trimmed.split("\n");
    const language = lines[0].slice(3).trim() || null;
    const code = lines.slice(1, lines[lines.length - 1] === "```" ? -1 : undefined).join("\n");
    return {
      type: "codeBlock",
      attrs: { language },
      content: code ? [{ type: "text", text: code }] : [],
    };
  }

  if (/^\$\$/.test(trimmed)) {
    const latex = trimmed.replace(/^\$\$\n?/, "").replace(/\n?\$\$$/, "");
    return { type: "blockMath", attrs: { latex } };
  }

  if (/^>\s?/.test(trimmed)) {
    return parseBlockquoteBlock(trimmed);
  }

  if (/^- \[[ xX]]\s/.test(trimmed)) {
    return parseTaskListBlock(trimmed);
  }

  if (/^[-*]\s/.test(trimmed)) {
    return parseListBlock(trimmed, false);
  }

  if (/^\d+\.\s/.test(trimmed)) {
    return parseListBlock(trimmed, true);
  }

  if (/^\|/.test(trimmed) && /^\|?[\s:|-]+\|?$/m.test(trimmed.split("\n")[1] ?? "")) {
    const table = parseTableBlock(trimmed);
    if (table) return table;
  }

  if (/^---$/.test(trimmed)) {
    return { type: "horizontalRule" };
  }

  const image = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(trimmed);
  if (image) {
    const rest = trimmed.slice(image[0].length).trim();
    const caption = /^\*(.+)\*$/.exec(rest)?.[1] ?? (image[1] || undefined);
    return {
      type: "image",
      attrs: { src: image[2], align: "center", ...(caption ? { caption } : {}) },
    };
  }

  return { type: "paragraph", content: inlineToTiptap(trimmed) };
}

/** Parse a Markdown body (no frontmatter) into a Tiptap `doc` node. */
export function markdownToTiptapDoc(markdown: string): JSONContent {
  const blocks = splitBlocks(markdown);

  // Footnote definitions are their own blocks (separated by blank lines like
  // everything else) but aren't real document content — pull them out before
  // the regular block parse so they don't turn into stray paragraphs.
  const defs = new Map<string, InlineNode[]>();
  const contentBlocks: string[] = [];
  for (const block of blocks) {
    const m = FOOTNOTE_DEF.exec(block.trim());
    if (m) {
      defs.set(m[1], parseInline(m[2]));
    } else {
      contentBlocks.push(block);
    }
  }

  const parsed = contentBlocks
    .map(parseBlock)
    .filter((n): n is JSONContent => n !== null);

  const footnotes: JSONContent[] = [];
  const content = resolveFootnotes(parsed, defs, footnotes);
  if (footnotes.length > 0) {
    content.push({ type: "footnotes", content: footnotes });
  }

  return { type: "doc", content };
}
