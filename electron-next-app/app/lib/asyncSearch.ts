import { scoreMatch } from "./searchScore";

export interface ScoredItem<T> {
  item: T;
  score: number;
}

function yieldToMain(): Promise<void> {
  if (typeof MessageChannel === "undefined") {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      resolve();
    };
    port2.postMessage(null);
  });
}

export async function scoreItemsAsync<T>(
  items: readonly T[],
  getIndex: (item: T) => string,
  tokens: string[],
  isCancelled: () => boolean,
  exact = false,
  batchSize = 5000,
): Promise<ScoredItem<T>[] | null> {
  const out: ScoredItem<T>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    if (isCancelled()) return null;
    const end = Math.min(items.length, i + batchSize);
    for (let j = i; j < end; j++) {
      const item = items[j];
      const score = scoreMatch(getIndex(item), tokens, exact);
      if (score > 0) out.push({ item, score });
    }
    if (end < items.length) await yieldToMain();
  }
  if (isCancelled()) return null;
  out.sort((a, b) => b.score - a.score);
  return out;
}
