import "server-only";
import { sql } from "./db";
import { embedQuery } from "./ollama";
import { rrf } from "./rank";
import { filterClause, getCards, type TrekCard } from "./treks";
import type { TrekFilters } from "./filters";

const CANDIDATES = 40;

export interface SearchResult {
  cards: TrekCard[];
  // Which side found anything, for the build log and debugging. Never includes the query text.
  matched: { fullText: number; vector: number };
}

// Hybrid search: full-text (OR of the query's lexemes) and EmbeddingGemma cosine distance,
// both restricted by the same filters, fused with RRF.
export async function searchTreks(query: string, filters: TrekFilters = {}, limit = 12): Promise<SearchResult> {
  const db = sql();
  const where = filterClause(filters);

  const fullText = await db<{ slug: string }[]>`
    with q as (
      select to_tsquery('english', array_to_string(
        array(select quote_literal(l) from unnest(tsvector_to_array(to_tsvector('english', ${query}))) l), ' | '
      )) as q
    )
    select d.slug
    from trek_docs d join treks t using (slug), q
    where numnode(q.q) > 0 and d.tsv @@ q.q ${where}
    order by ts_rank_cd(d.tsv, q.q) desc, d.slug
    limit ${CANDIDATES}
  `;

  let vector: { slug: string }[] = [];
  const embedding = await embedQuery(query).catch(() => null);
  if (embedding) {
    const literal = `[${embedding.join(",")}]`;
    vector = await db<{ slug: string }[]>`
      select d.slug
      from trek_docs d join treks t using (slug)
      where d.embedding is not null ${where}
      order by d.embedding <=> ${literal}::vector, d.slug
      limit ${CANDIDATES}
    `;
  }

  const fused = rrf([fullText.map((r) => r.slug), vector.map((r) => r.slug)]).slice(0, limit);
  return {
    cards: await getCards(fused.map((f) => f.id)),
    matched: { fullText: fullText.length, vector: vector.length },
  };
}
