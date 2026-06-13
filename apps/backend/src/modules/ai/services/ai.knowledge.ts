import { AI_EMBEDDING_MODEL, AI_RAG_ENABLED, AI_RAG_MAX_CHARS, AI_RAG_TOP_K } from '@/config/ai'
import { AiKnowledgeRepository } from '../repositories/ai-knowledge.repository'
import { embedTexts } from './ai.client'
import { buildCacheKey, cacheGet, cacheSet } from './ai.cache'

const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 80

const splitIntoChunks = (text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] => {
  const cleaned = String(text || '').replace(/\r/g, '').trim()
  if (!cleaned) return []
  const chunks: string[] = []
  let i = 0
  while (i < cleaned.length) {
    const end = Math.min(i + size, cleaned.length)
    const slice = cleaned.slice(i, end).trim()
    if (slice) chunks.push(slice)
    if (end >= cleaned.length) break
    i = Math.max(0, end - overlap)
  }
  return chunks
}

const parseEmbedding = (value: any): number[] | null => {
  if (!value) return null
  if (Array.isArray(value)) return value.map(Number).filter(n => Number.isFinite(n))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(Number).filter(n => Number.isFinite(n))
    } catch {}
  }
  return null
}

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i]
    const bv = b[i]
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  if (!na || !nb) return 0
  return dot / Math.sqrt(na * nb)
}

const trimContent = (text: string) =>
  text.length > AI_RAG_MAX_CHARS ? text.slice(0, AI_RAG_MAX_CHARS) : text

export class AiKnowledgeService {
  static async addDocument(input: {
    title?: string
    content: string
    tags?: string
    source?: string
  }) {
    const chunks = splitIntoChunks(input.content)
    if (!chunks.length) return { created: 0 }
    let embeddings: number[][] | null = null
    if (AI_EMBEDDING_MODEL) {
      try {
        embeddings = await embedTexts(chunks, AI_EMBEDDING_MODEL)
      } catch {
        embeddings = null
      }
    }

    let created = 0
    for (let i = 0; i < chunks.length; i++) {
      const embedding = embeddings?.[i]
      await AiKnowledgeRepository.insertChunk({
        title: input.title ?? null,
        content: chunks[i],
        tags: input.tags ?? null,
        source: input.source ?? null,
        embeddingJson: embedding ? JSON.stringify(embedding) : null,
      })
      created += 1
    }
    return { created }
  }

  static async search(query: string, topK = AI_RAG_TOP_K) {
    if (!AI_RAG_ENABLED) return []
    const q = String(query || '').trim()
    if (!q) return []

    const cacheKey = buildCacheKey('rag', { q, topK, embed: !!AI_EMBEDDING_MODEL })
    const cached = await cacheGet<any[]>(cacheKey)
    if (cached) return cached

    if (AI_EMBEDDING_MODEL) {
      try {
        const [qEmb] = await embedTexts([q], AI_EMBEDDING_MODEL)
        if (qEmb?.length) {
          const rows = await AiKnowledgeRepository.listEmbeddingCandidates(200)
          const scored = rows
            .map(row => {
              const emb = parseEmbedding(row.embedding_json)
              const score = emb ? cosineSimilarity(qEmb, emb) : 0
              return { ...row, score }
            })
            .filter(r => r.score > 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(r => ({
              id: r.id,
              title: r.title,
              content: trimContent(r.content || ''),
              tags: r.tags,
              source: r.source,
              score: r.score,
            }))
          await cacheSet(cacheKey, scored, 300)
          return scored
        }
      } catch {}
    }

    const rows = await AiKnowledgeRepository.searchByKeyword(q, topK)
    const fallback = rows.map(r => ({
      id: r.id,
      title: r.title,
      content: trimContent(r.content || ''),
      tags: r.tags,
      source: r.source,
      score: 0,
    }))
    await cacheSet(cacheKey, fallback, 300)
    return fallback
  }
}
