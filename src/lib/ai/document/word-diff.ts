export interface WordDiffPart {
  kind: "equal" | "add" | "remove";
  text: string;
}

function tokens(value: string): string[] {
  return value.match(/\s+|[^\s]+/gu) ?? [];
}

export function createWordDiff(original: string, suggested: string): WordDiffPart[] {
  const left = tokens(original);
  const right = tokens(suggested);
  const lengths = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        left[i] === right[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const parts: WordDiffPart[] = [];
  const append = (kind: WordDiffPart["kind"], text: string) => {
    const previous = parts.at(-1);
    if (previous?.kind === kind) previous.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      append("equal", left[i]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      append("remove", left[i]);
      i += 1;
    } else {
      append("add", right[j]);
      j += 1;
    }
  }
  while (i < left.length) append("remove", left[i++]);
  while (j < right.length) append("add", right[j++]);
  return parts;
}

