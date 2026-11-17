create extension if not exists vector with schema extensions;

create table if not exists public.byu_knowledge_chunks (
  id bigint generated always as identity primary key,
  source_url text not null,
  source_title text not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  content_hash text not null,
  embedding extensions.vector(768) not null,
  fetched_at timestamptz not null default now(),
  unique (source_url, chunk_index)
);

create index if not exists byu_knowledge_chunks_embedding_hnsw
  on public.byu_knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.byu_knowledge_chunks enable row level security;

revoke all on public.byu_knowledge_chunks from anon, authenticated;
grant select, insert, update, delete on public.byu_knowledge_chunks to service_role;
grant usage, select on sequence public.byu_knowledge_chunks_id_seq to service_role;

create or replace function public.match_byu_knowledge(
  query_embedding extensions.vector(768),
  match_count integer default 6,
  min_similarity real default 0.45
)
returns table (
  source_url text,
  source_title text,
  content text,
  similarity real
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    chunks.source_url,
    chunks.source_title,
    chunks.content,
    (1 - (chunks.embedding <=> query_embedding))::real as similarity
  from public.byu_knowledge_chunks as chunks
  where 1 - (chunks.embedding <=> query_embedding) >= min_similarity
  order by chunks.embedding <=> query_embedding
  limit greatest(1, least(match_count, 8));
$$;

revoke all on function public.match_byu_knowledge(extensions.vector, integer, real)
  from public, anon, authenticated;
grant execute on function public.match_byu_knowledge(extensions.vector, integer, real)
  to service_role;
