-- Gestor de Prazos de Licenciamento — schema inicial
-- Tabelas: membros (quem pode acessar e com que papel) e licencas (processos/etapas por obra)

-- ---------- membros ----------
create table if not exists public.membros (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text,
  papel     text not null default 'leitor' check (papel in ('leitor', 'editor')),
  criado_em timestamptz not null default now()
);

comment on table public.membros is 'Usuários autorizados no gestor. leitor = só vê; editor = cadastra, edita e exclui.';

alter table public.membros enable row level security;

-- cada usuário enxerga apenas o próprio registro (para o app saber o papel)
create policy "membro ve o proprio registro"
  on public.membros for select
  to authenticated
  using (user_id = (select auth.uid()));

-- helpers usados nas policies (security definer para não depender da RLS de membros)
create or replace function public.is_membro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.membros m where m.user_id = (select auth.uid()));
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.membros m where m.user_id = (select auth.uid()) and m.papel = 'editor');
$$;

revoke execute on function public.is_membro() from public, anon;
revoke execute on function public.is_editor() from public, anon;
grant execute on function public.is_membro() to authenticated;
grant execute on function public.is_editor() to authenticated;

-- ---------- licencas ----------
create table if not exists public.licencas (
  id              uuid primary key default gen_random_uuid(),
  obra            text not null check (length(trim(obra)) > 0),
  tipo            text not null check (length(trim(tipo)) > 0),
  ordem           integer check (ordem > 0),
  fase            text not null default 'Licenciamento' check (fase in ('Licenciamento', 'Execução', 'Vendas')),
  orgao           text,
  protocolo       text,
  status          text not null default 'em_preparo' check (status in (
                    'em_preparo', 'protocolado', 'em_analise', 'em_execucao', 'exigencia',
                    'aprovado', 'concluido', 'indeferido', 'encerrado')),
  data_protocolo  date,
  duracao         integer check (duracao >= 0),
  vencimento      date,
  responsavel     text,
  notas           text,
  exemplo         boolean not null default false,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_por      uuid references auth.users (id) on delete set null default auth.uid(),
  atualizado_por  uuid references auth.users (id) on delete set null default auth.uid(),
  constraint licencas_termino_apos_inicio check (data_protocolo is null or vencimento is null or vencimento >= data_protocolo)
);

comment on table public.licencas is 'Cada licença/etapa de cada obra, com início, duração e término (prazo).';
comment on column public.licencas.data_protocolo is 'Início (data de protocolo).';
comment on column public.licencas.vencimento is 'Término = início + duração (dias corridos), ou informado direto.';

create index if not exists licencas_vencimento_idx on public.licencas (vencimento);
create index if not exists licencas_obra_idx on public.licencas (obra);
create index if not exists licencas_criado_por_idx on public.licencas (criado_por);
create index if not exists licencas_atualizado_por_idx on public.licencas (atualizado_por);

-- atualizado_em / atualizado_por automáticos
create or replace function public.licencas_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

create trigger licencas_touch
  before update on public.licencas
  for each row execute function public.licencas_touch();

alter table public.licencas enable row level security;

create policy "membros leem licencas"
  on public.licencas for select
  to authenticated
  using ((select public.is_membro()));

create policy "editores inserem licencas"
  on public.licencas for insert
  to authenticated
  with check ((select public.is_editor()));

create policy "editores atualizam licencas"
  on public.licencas for update
  to authenticated
  using ((select public.is_editor()))
  with check ((select public.is_editor()));

create policy "editores excluem licencas"
  on public.licencas for delete
  to authenticated
  using ((select public.is_editor()));
