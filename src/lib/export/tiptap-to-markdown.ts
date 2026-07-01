import type { JSONContent } from "@tiptap/core";

// Converts a Tiptap document (AnvilDocument.content — an unwrapped `doc`
// node) to plain Markdown, for the .md backup/export feature. Math nodes
// already carry LaTeX in `attrs.latex`, so — unlike the Typst converter —
// no math translation is needed, just wrapping in `$…$` / `$$…$$`.

type Node = JSONContent;
type Mark = { type?: string; attrs?: Record<string, unknown> };

function asNodes(content: unknown): Node[] {
  return Array.isArray(content) ? (content as Node[]) : [];
}

function attrLatex(node: Node): string {
  const attrs = node.attrs ?? {};
  for (const key of ["latex", "formula", "equation", "value"]) {
    const value = attrs[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return typeof node.text === "string" ? node.text : "";
}

function textContent(content: unknown): string {
  return asNodes(content)
    .map((node) => (typeof node.text === "string" ? node.text : textContent(node.content)))
    .join("");
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

// --- inline -------------------------------------------------------------

function renderTextNode(node: Node): string {
  const raw = typeof node.text === "string" ? node.text : "";
  if (!raw) return "";
  const marks: Mark[] = Array.isArray(node.marks) ? (node.marks as Mark[]) : [];
  const isCode = marks.some((mark) => mark?.type === "code");

  let out = isCode ? `\`${raw.replace(/`/g, "\\`")}\`` : raw;

  for (const mark of marks) {
    switch (mark?.type) {
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "underline":
        // No native Markdown syntax; HTML <u> is widely supported by GFM renderers.
        out = `<u>${out}</u>`;
        break;
      case "link": {
        const href = mark.attrs?.href;
        if (typeof href === "string" && href) {
          out = `[${out}](${href})`;
        }
        break;
      }
      default:
        break;
    }
  }

  return out;
}

export function inlineToMarkdown(content: unknown): string {
  if (typeof content === "string") return content;
  return asNodes(content)
    .map((node) => {
      if (!node || typeof node !== "object") return "";
      const type = node.type;
      if (type === "text") return renderTextNode(node);
      if (type === "inlineMath" || type === "math") {
        const latex = attrLatex(node);
        return latex.trim() ? `$${latex}$` : "";
      }
      if (type === "hardBreak") return "  \n";
      return "";
    })
    .join("");
}

// --- blocks ---------------------------------------------------------------

function indentLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");
}

// Like indentLines, but blank lines get a bare ">" instead of staying empty —
// a truly empty line would make splitBlocks() (2+ newlines = new block) treat
// the quote's own internal paragraph gaps as ending the blockquote early.
function quoteLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line ? prefix + line : prefix.trimEnd()))
    .join("\n");
}

function renderList(node: Node, ordered: boolean): string {
  const lines: string[] = [];
  let n = 1;
  for (const item of asNodes(node.content)) {
    const inlineParts: string[] = [];
    const nestedParts: string[] = [];
    for (const child of asNodes(item.content)) {
      if (child.type === "bulletList" || child.type === "orderedList" || child.type === "taskList") {
        nestedParts.push(indentLines(renderBlock(child), "  "));
      } else {
        inlineParts.push(renderBlock(child));
      }
    }
    const marker = ordered ? `${n}.` : "-";
    lines.push(`${marker} ${inlineParts.join(" ").trim()}`.trim());
    lines.push(...nestedParts);
    n += 1;
  }
  return lines.join("\n");
}

function renderTaskList(node: Node): string {
  const lines: string[] = [];
  for (const item of asNodes(node.content)) {
    const checked = item.attrs?.checked === true;
    const inner = asNodes(item.content).map((child) => renderBlock(child)).join(" ").trim();
    lines.push(`- [${checked ? "x" : " "}] ${inner}`.trim());
  }
  return lines.join("\n");
}

function renderTable(node: Node): string {
  const rows = asNodes(node.content).filter((row) => row.type === "tableRow");
  if (rows.length === 0) return "";

  const firstCells = asNodes(rows[0].content);
  const hasHeader = firstCells.length > 0 && firstCells.every((cell) => cell.type === "tableHeader");
  const columns = firstCells.length || 1;

  const cellText = (cell: Node) => escapeCell(renderBlocks(asNodes(cell.content)).replace(/\n+/g, " ").trim());

  const headerCells = hasHeader ? firstCells.map(cellText) : Array.from({ length: columns }, () => "");
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  const lines = [
    `| ${headerCells.join(" | ")} |`,
    `| ${headerCells.map(() => "---").join(" | ")} |`,
  ];
  for (const row of bodyRows) {
    const cells = asNodes(row.content).map(cellText);
    lines.push(`| ${cells.join(" | ")} |`);
  }

  const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
  return caption ? `${lines.join("\n")}\n\n*${caption}*` : lines.join("\n");
}

function renderImage(node: Node): string {
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
  if (!src) return "";
  const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
  const alt = caption || "";
  return caption ? `![${alt}](${src})\n\n*${caption}*` : `![${alt}](${src})`;
}

function renderBlock(node: Node): string {
  const type = typeof node.type === "string" ? node.type : "paragraph";

  switch (type) {
    case "heading": {
      const level = Math.min(Math.max(typeof node.attrs?.level === "number" ? node.attrs.level : 1, 1), 6);
      return `${"#".repeat(level)} ${inlineToMarkdown(node.content)}`.trim();
    }
    case "paragraph":
      return inlineToMarkdown(node.content);
    case "bulletList":
      return renderList(node, false);
    case "orderedList":
      return renderList(node, true);
    case "taskList":
      return renderTaskList(node);
    case "blockquote": {
      const inner = renderBlocks(asNodes(node.content));
      return inner ? quoteLines(inner, "> ") : "";
    }
    case "callout": {
      const kind = typeof node.attrs?.kind === "string" ? node.attrs.kind : "note";
      const title = typeof node.attrs?.title === "string" ? node.attrs.title.trim() : "";
      const label = title ? `**${kind.toUpperCase()}: ${title}**` : `**${kind.toUpperCase()}**`;
      const inner = renderBlocks(asNodes(node.content));
      return quoteLines([label, inner].filter(Boolean).join("\n\n"), "> ");
    }
    case "codeBlock": {
      const lang = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      const code = textContent(node.content);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case "blockMath":
    case "math":
    case "equation": {
      const latex = attrLatex(node);
      return latex.trim() ? `$$\n${latex}\n$$` : "";
    }
    case "horizontalRule":
      return "---";
    case "image":
      return renderImage(node);
    case "table":
      return renderTable(node);
    case "hardBreak":
      return "";
    default:
      return inlineToMarkdown(node.content);
  }
}

function renderBlocks(nodes: Node[]): string {
  return nodes
    .map((node) => renderBlock(node ?? {}))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/** Convert an AnvilDocument's `content` (an unwrapped Tiptap `doc` node) to Markdown. */
export function tiptapDocToMarkdown(doc: JSONContent): string {
  return renderBlocks(asNodes(doc.content));
}
