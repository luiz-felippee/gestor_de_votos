-- ============================================================================
-- Gestor de Votos — Schema PostgreSQL (backend próprio)
-- ============================================================================

create extension if not exists "pgcrypto";

-- Perfis de acesso
do $$
begin
  if not exists (select 1 from pg_type where typname = 'perfil_acesso') then
    create type perfil_acesso as enum ('admin', 'coordenador', 'cabo', 'visualizador');
  end if;
  if not exists (select 1 from pg_type where typname = 'status_eleitor') then
    create type status_eleitor as enum ('ativo', 'inativo', 'pendente');
  end if;
end$$;

-- Cabos eleitorais
create table if not exists cabos_eleitorais (
  id              uuid primary key default gen_random_uuid(),
  nome            varchar(255) not null,
  telefone        varchar(20)  not null,
  bairro_atuacao  varchar(100),
  cidade          varchar(100),
  meta_eleitores  integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Usuários do sistema (os 4 com acesso, + outros perfis)
create table if not exists usuarios (
  id            uuid primary key default gen_random_uuid(),
  nome          varchar(255) not null,
  email         varchar(255) not null unique,
  senha_hash    varchar(255) not null,
  role          perfil_acesso not null default 'visualizador',
  cabo_id       uuid references cabos_eleitorais (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Eleitores
create table if not exists eleitores (
  id            uuid primary key default gen_random_uuid(),
  nome          varchar(255) not null,
  telefone      varchar(20)  not null,
  local_votacao varchar(255) not null,
  zona          integer not null,
  secao         integer not null,
  bairro        varchar(100) not null,
  cidade        varchar(100) not null,
  cabo_id       uuid references cabos_eleitorais (id) on delete set null,
  status        status_eleitor not null default 'ativo',
  observacoes   text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_eleitores_cidade   on eleitores (cidade);
create index if not exists idx_eleitores_bairro   on eleitores (bairro);
create index if not exists idx_eleitores_zona_sec on eleitores (zona, secao);
create index if not exists idx_eleitores_cabo     on eleitores (cabo_id);
create index if not exists idx_eleitores_created  on eleitores (created_at desc);

-- Duplicidade: mesmo nome + zona + seção não repete
create unique index if not exists uq_eleitor_nome_zona_secao
  on eleitores (lower(trim(nome)), zona, secao);
