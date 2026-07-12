function clampIndex(index: number, length: number) {
  return Math.min(Math.max(Math.trunc(index), 0), length);
}

function distributeWithMinimum(weights: number[], total: number, minimum: number) {
  const safeMinimum = Math.max(0, minimum);
  const targetTotal = Math.max(total, weights.length * safeMinimum);
  const result = Array<number>(weights.length).fill(0);
  const remaining = new Set(weights.map((_, index) => index));
  let remainingTotal = targetTotal;

  while (remaining.size > 0) {
    const weightTotal = [...remaining].reduce(
      (sum, index) => sum + Math.max(weights[index], 0),
      0,
    );
    const fallbackWeight = weightTotal > 0 ? null : 1;
    const undersized = [...remaining].filter((index) => {
      const weight = fallbackWeight ?? Math.max(weights[index], 0);
      const denominator = fallbackWeight ? remaining.size : weightTotal;
      return (remainingTotal * weight) / denominator < safeMinimum;
    });

    if (undersized.length === 0) {
      for (const index of remaining) {
        const weight = fallbackWeight ?? Math.max(weights[index], 0);
        const denominator = fallbackWeight ? remaining.size : weightTotal;
        result[index] = (remainingTotal * weight) / denominator;
      }
      break;
    }

    for (const index of undersized) {
      result[index] = safeMinimum;
      remaining.delete(index);
      remainingTotal -= safeMinimum;
    }
  }

  return result;
}

export function insertTrackSize(
  sizes: number[],
  insertionIndex: number,
  total: number,
  minimum: number,
  existingCount = sizes.length,
) {
  const count = Math.max(0, Math.trunc(existingCount));
  const index = clampIndex(insertionIndex, count);

  if (sizes.length !== count || count === 0) {
    const targetTotal = Math.max(total, (count + 1) * minimum);
    return Array<number>(count + 1).fill(targetTotal / (count + 1));
  }

  const safeSizes = sizes.map((size) =>
    Number.isFinite(size) && size > 0 ? size : minimum,
  );
  const average = safeSizes.reduce((sum, size) => sum + size, 0) / count;
  const weights = [...safeSizes];
  weights.splice(index, 0, average);
  return distributeWithMinimum(weights, total, minimum);
}

export function resizeTrackPair(
  sizes: number[],
  boundaryIndex: number,
  delta: number,
  minimum: number,
) {
  if (boundaryIndex < 0 || boundaryIndex >= sizes.length - 1) {
    return [...sizes];
  }

  const next = [...sizes];
  const left = next[boundaryIndex];
  const right = next[boundaryIndex + 1];
  const clampedDelta = Math.min(
    Math.max(delta, minimum - left),
    right - minimum,
  );
  next[boundaryIndex] = left + clampedDelta;
  next[boundaryIndex + 1] = right - clampedDelta;
  return next;
}
