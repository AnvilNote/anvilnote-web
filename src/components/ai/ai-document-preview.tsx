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
    case "callout": return (
      <aside key={key} className="space-y-2 rounded-xl border-l-4 border-primary/40 bg-muted/45 p-3" data-ai-preview-type="callout" data-callout-kind={node.attrs.kind}>
        {node.attrs.title ? <p className="font-medium">{node.attrs.title}</p> : null}
        {node.content.map((item, index) => block(item, `${key}-${index}`))}
      </aside>
    );
    case "proof": return (
      <section key={key} className="space-y-2 border-l-2 border-border pl-3" data-ai-preview-type="proof">
        {node.content.map((item, index) => block(item, `${key}-${index}`))}
        <div className="flex justify-end" aria-label="QED">
          <span className="size-2.5 bg-foreground" data-ai-preview-qed aria-hidden="true" />
        </div>
      </section>
    );
    case "question": return (
      <ol key={key} className="space-y-4" data-ai-preview-type="question">
        {node.content.map((item, itemIndex) => {
          const choices = item.content.find((child) => child.type === "choiceList");
          const body = item.content.filter((child) => child.type !== "choiceList");
          return (
            <li key={`${key}-${itemIndex}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-1.5">
              <span className="font-medium">{itemIndex + 1}.</span>
              <div className="min-w-0 space-y-2">
                {body.map((child, childIndex) => block(child, `${key}-${itemIndex}-body-${childIndex}`))}
                {choices?.type === "choiceList" ? (
                  <div className="space-y-1.5" data-ai-preview-choices={item.attrs.kind}>
                    {choices.content.map((choice, choiceIndex) => (
                      <div key={`${key}-${itemIndex}-choice-${choiceIndex}`} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2">
                        <span aria-hidden="true">{item.attrs.kind === "multi" ? "□" : "○"}</span>
                        <div>{choice.content.map((child, childIndex) => block(child, `${key}-${itemIndex}-choice-${choiceIndex}-${childIndex}`))}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {item.attrs.kind === "written" ? (
                  item.attrs.writtenMode === "lines" ? (
                    <div className="space-y-3 pt-1" data-ai-preview-written-answer="lines">
                      {Array.from({ length: Math.min(item.attrs.writtenLines, 6) }, (_, lineIndex) => (
                        <div key={`${key}-${itemIndex}-line-${lineIndex}`} className="border-b border-border" />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="min-h-12 rounded-md border border-dashed border-border"
                      data-ai-preview-written-answer="blank"
                      style={{ height: `${Math.min(160, Math.max(48, item.attrs.writtenHeightPercent * 1.2))}px` }}
                    />
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    );
    case "questionItem": return <div key={key}>{node.content.map((item, index) => block(item, `${key}-${index}`))}</div>;
    case "choiceList": return <div key={key}>{node.content.map((item, index) => block(item, `${key}-${index}`))}</div>;
    case "choiceItem": return <div key={key}>{node.content.map((item, index) => block(item, `${key}-${index}`))}</div>;
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
    <div className="space-y-3 text-sm">
      {document.content.map((node, index) => block(node, `preview-${index}`))}
    </div>
  );
}
