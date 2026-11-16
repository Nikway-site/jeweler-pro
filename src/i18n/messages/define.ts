/**
 * Message definition helpers.
 *
 * The first eight slots are required, in the order of LANGUAGES:
 *   [tr, en, de, fr, es, ru, ar, zh]
 * A ninth, optional fa-IR slot may be reviewed incrementally in this same
 * source tree. Persian is NOT a runtime language or generated locale until
 * every message is translated, checked and explicitly enabled.
 * Keeping the released languages side by side preserves existing coverage.
 */
export type L = readonly [string, string, string, string, string, string, string, string, string?];

export interface MessageTree {
  readonly [key: string]: L | MessageTree;
}

export function defineMessages<T extends MessageTree>(tree: T): T {
  return tree;
}

export type Catalog = { [key: string]: string | Catalog };

export function project(tree: MessageTree, index: number): Catalog {
  const out: Catalog = {};
  for (const [key, value] of Object.entries(tree)) {
    out[key] = Array.isArray(value) ? (value as unknown as string[])[index] : project(value as MessageTree, index);
  }
  return out;
}
