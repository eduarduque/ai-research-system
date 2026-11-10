export type Chunk = { index: number; text: string };

const DEFAULT_SIZE = 900;
const DEFAULT_OVERLAP = 150;

/**
 * Split article text into overlapping ~`size`-character chunks, breaking on
 * paragraph, then sentence, then word boundaries so a chunk never cuts a
 * sentence in half unless the sentence itself is longer than a chunk.
 *
 * Retrieval works on chunks rather than whole documents: a single embedding of
 * a 20k-char article averages away the one paragraph that answers a question.
 */
export function chunkText(text: string, size = DEFAULT_SIZE, overlap = DEFAULT_OVERLAP): Chunk[] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [{ index: 0, text: clean }];

  // Units: sentences within paragraphs. Oversized sentences get hard-split on words.
  const units: string[] = [];
  for (const para of clean.split(/\n\s*\n/)) {
    const sentences = para.match(/[^.!?\n]+(?:[.!?]+["')\]]*|\n|$)/g) ?? [para];
    for (const raw of sentences) {
      const s = raw.trim();
      if (!s) continue;
      if (s.length <= size) {
        units.push(s);
      } else {
        let buf = "";
        for (const word of s.split(" ")) {
          if (buf && buf.length + word.length + 1 > size) {
            units.push(buf);
            buf = "";
          }
          buf = buf ? `${buf} ${word}` : word;
        }
        if (buf) units.push(buf);
      }
    }
  }

  const chunks: Chunk[] = [];
  let current: string[] = [];
  let len = 0;
  for (const unit of units) {
    if (len > 0 && len + unit.length + 1 > size) {
      chunks.push({ index: chunks.length, text: current.join(" ") });
      // Carry trailing sentences forward as overlap so context isn't lost at the seam.
      const carry: string[] = [];
      let carryLen = 0;
      for (let i = current.length - 1; i >= 0 && carryLen + current[i].length <= overlap; i--) {
        carry.unshift(current[i]);
        carryLen += current[i].length + 1;
      }
      current = carry;
      len = carryLen;
    }
    current.push(unit);
    len += unit.length + 1;
  }
  if (current.length) chunks.push({ index: chunks.length, text: current.join(" ") });
  return chunks;
}
