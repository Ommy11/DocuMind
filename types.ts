
export interface Document {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  lastModified: number;
  chunks: Chunk[];
}

export interface Chunk {
  documentId: string;
  documentName: string;
  text: string;
  index: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: Source[];
}

export interface Source {
  documentName: string;
  snippet: string;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}
