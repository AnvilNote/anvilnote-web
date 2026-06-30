import { QUOTES, type Quote } from "./data";

export type { Quote };

/** Returns a random English quote. */
export function getRandomQuote(): Quote {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
