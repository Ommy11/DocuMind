
import { Document, Chunk, SearchResult } from '../types';

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

/**
 * Splits a document's text into overlapping chunks for better context retrieval.
 */
export const chunkDocument = (docId: string, docName: string, text: string): Chunk[] => {
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkText = text.slice(start, end);
    
    chunks.push({
      documentId: docId,
      documentName: docName,
      text: chunkText,
      index: chunks.length
    });

    if (end === text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
};

/**
 * Simple TF-IDF inspired local search. 
 * Since we can't easily run full vector DBs in browser without complex WASM, 
 * we use a keyword similarity and proximity score.
 */
export const searchChunks = (query: string, allChunks: Chunk[], limit: number = 5): SearchResult[] => {
  const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  
  if (queryWords.length === 0) return [];

  const results: SearchResult[] = allChunks.map(chunk => {
    let score = 0;
    const chunkTextLower = chunk.text.toLowerCase();
    
    queryWords.forEach(word => {
      const regex = new RegExp(word, 'g');
      const matches = chunkTextLower.match(regex);
      if (matches) {
        // Frequency boost
        score += matches.length;
        // Exact match in snippet boost
        if (chunkTextLower.includes(word)) score += 2;
      }
    });

    return { chunk, score };
  });

  return results
    .filter(res => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
