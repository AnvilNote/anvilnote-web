import type { ReactNode } from "react";
import type {
  AnvilNoteBlockNodeV1,
  AnvilNoteDocumentFragmentV1,
  AnvilNoteDocumentV1,
  AnvilNoteInlineNodeV1,
} from "@anvilnote/ai-writer/document";

type PreviewDocument = AnvilNoteDocumentV1 | AnvilNoteDocumentFragmentV1;

function inline(node: AnvilNoteInlineNodeV1, key: string): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "inlineMath") {
    return <code key={key} className="rounded bg-muted px-1">{`$${node.attrs.latex}$`}</code>;
  }
  let value: ReactNode = node.text;
  for (const [index, mark] of (node.marks ?? []).entries()) {
    const markKey = `${key}-mark-${index}`;
    switch (mark.type) {
      case "bold": value = <strong key={markKey}>{value}</strong>; break;
      case "italic": value = <em key={markKey}>{value}</em>; break;
      case "strike": value = <s key={markKey}>{value}</s>; break;
      case "code": value = <code key={markKey} className="rounded bg-muted px-1">{value}</code>; break;
      case "underline": value = <u key={markKey}>{value}</u>; break;
      case "link":
        value = <a key={markKey} href={mark.attrs.href} title={mark.attrs.title ?? undefined} target={mark.attrs.target ?? undefined} rel="noopener noreferrer" className="underline underline-offset-2">{value}</a>;
        break;
    }
  }
  return <span key={key}>{value}</span>;
}

function block(node: AnvilNoteBlockNodeV1, key: string): ReactNode {
  switch (node.type) {
    case "paragraph": return <p key={key} className="min-h-5">{node.content.map((item, index) => inline(item, `${key}-${index}`))}</p>;
    case "heading": {
      const content = node.content.map((item, index) => inline(item, `${key}-${index}`));
      if (node.attrs.level === 1) return <h1 key={key} className="text-xl font-semibold">{content}</h1>;
      if (node.attrs.level === 2) return <h2 key={key} className="text-lg font-semibold">{content}</h2>;
      return <h3 key={key} className="font-semibold">{content}</h3>;
    }
    case "bulletList": return <ul key={key} className="list-disc space-y-1 pl-5">{node.content.map((item, index) => block(item, `${key}-${index}`))}</ul>;
    case "orderedList": return <ol key={key} start={node.attrs?.start} className="list-decimal space-y-1 pl-5">{node.content.map((item, index) => block(item, `${key}-${index}`))}</ol>;
    case "listItem": return <li key={key}>{node.content.map((item, index) => block(item, `${key}-${index}`))}</li>;
    case "blockquote": return <blockquote key={key} className="border-l-2 pl-3 text-muted-foreground">{node.content.map((item, index) => block(item, `${key}-${index}`))}</blockquote>;
    case "codeBlock": return <pre key={key} className="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code data-language={node.attrs.language}>{node.content.map((item, index) => inline(item, `${key}-${index}`))}</code></pre>;
    case "mathBlock": return <pre key={key} className="overflow-x-auto rounded-md border p-3 text-center">{`$$${node.attrs.latex}$$`}</pre>;
    case "table": return <div key={key} className="overflow-x-auto"><table className="w-full border-collapse text-xs"><tbody>{node.content.map((item, index) => block(item, `${key}-${index}`))}</tbody></table></div>;
    case "tableRow": return <tr key={key}>{node.content.map((item, index) => block(item, `${key}-${index}`))}</tr>;
    case "tableHeader": return <th key={key} colSpan={node.attrs.colspan} rowSpan={node.attrs.rowspan} className="border bg-muted p-2 text-left">{node.content.map((item, index) => block(item, `${key}-${index}`))}</th>;
    case "tableCell": return <td key={key} colSpan={node.attrs.colspan} rowSpan={node.attrs.rowspan} className="border p-2 align-top">{node.content.map((item, index) => block(item, `${key}-${index}`))}</td>;
    case "horizontalRule": return <hr key={key} />;
  }
}

export function aiDocumentPlainText(document: PreviewDocument): string {
  const visit = (node: AnvilNoteBlockNodeV1 | AnvilNoteInlineNodeV1): string => {
    if (node.type === "text") return node.text;
    if (node.type === "hardBreak") return "\n";
    if (node.type === "inlineMath" || node.type === "mathBlock") return node.attrs.latex;
    if ("content" in node) return node.content.map(visit).join(" ").trim();
    return "";
  };
  return document.content.map(visit).join("\n").trim();
}

export function AIDocumentPreview({ document }: { document: PreviewDocument }) {
  return (
    <div className="space-y-3 rounded-lg border bg-background p-4 text-sm">
      {document.content.map((node, index) => block(node, `preview-${index}`))}
    </div>
  );
}

