import { v4 as uuidv4 } from "uuid";
import { chunkText } from "./chunk";
import { embedTexts, getEmbeddingModelId, vectorToBlob } from "./embeddings";
import { replaceChunks, getSourcesNeedingIndex } from "./db";

type IndexableSource = { id: string; title: string; content: string };

/**
 * Chunk a source and embed each chunk. Embedding failure is non-fatal: chunks
 * are stored without vectors and retrieval falls back to BM25 for them.
 * Returns how many chunks were stored and whether they got vectors.
 */
export async function indexSource(source: IndexableSource): Promise<{ chunks: number; embedded: boolean }> {
  const chunks = chunkText(source.content);
  if (chunks.length === 0) chunks.push({ index: 0, text: source.title });

  let vectors: number[][] | null = null;
  let model: string | null = null;
  if (getEmbeddingModelId()) {
    try {
      // The title is prepended for embedding only: it gives every chunk topical context.
      const res = await embedTexts(chunks.map((c) => `${source.title}\n\n${c.text}`));
      vectors = res.vectors;
      model = res.model;
    } catch (err) {
      console.warn(`Embedding failed for "${source.title}" — keyword search only:`, err instanceof Error ? err.message : err);
    }
  }

  replaceChunks(
    source.id,
    chunks.map((c, i) => ({
      id: uuidv4(),
      idx: c.index,
      text: c.text,
      embedding: vectors ? vectorToBlob(vectors[i]) : null,
      model,
    }))
  );
  return { chunks: chunks.length, embedded: vectors !== null };
}

/** Index every source that has no chunks yet or was embedded by a different model. */
export async function reindexStale(onProgress?: (done: number, total: number) => void): Promise<number> {
  const stale = getSourcesNeedingIndex(getEmbeddingModelId()) as IndexableSource[];
  let done = 0;
  for (const s of stale) {
    await indexSource(s);
    onProgress?.(++done, stale.length);
  }
  return stale.length;
}
