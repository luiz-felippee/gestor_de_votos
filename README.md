# Gestor de Votos

Sistema web para campanhas políticas: cadastro de eleitores via formulário público
e planilha interna com atualização **em tempo real**, organizada por local de
votação (zona, seção, bairro, cidade) e vinculada ao cabo eleitoral responsável.

> **Status:** Formulário de cadastro, Planilha em tempo real, Dashboard de KPIs,
> Gestão de Cabos e autenticação com perfis de acesso. Backend próprio em
> **Node + PostgreSQL** (sem dependência de serviços externos).
> Pendente: mapa de calor (requer geolocalização).

## Arquitetura

```
Navegador (React)  ──►  API (Node/Express)  ──►  PostgreSQL
  o povo + os 4          login, permissões,        seus dados
                         tempo real (Socket.io)
```

| Camada       | Tecnologia                                              |
| ------------ | ------------------------------------------------------- |
| Front-end    | React + TypeScript + Vite + TailwindCSS + React Router  |
| Gráficos     | Recharts                                                |
| Exportação   | SheetJS (`xlsx`) — Excel e CSV                          |
| Back-end     | Node.js + Express                                       |
| Autenticação | JWT + bcrypt (senhas criptografadas)                    |
| Tempo real   | Socket.io                                               |
| Banco        | PostgreSQL                                              |

O navegador **não acessa o banco diretamente** — ele fala com a API, que valida
login e permissões e conversa com o PostgreSQL.

## Pré-requisitos

- Node.js 20+ (testado com 22)
- **Docker Desktop** (para rodar o PostgreSQL) — ou um PostgreSQL próprio

## Como rodar (passo a passo)

### 1. Subir o PostgreSQL (Docker)

Com o **Docker Desktop aberto**, na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe um PostgreSQL em `localhost:5432` (usuário `gestor`, senha `gestor`,
banco `gestor_votos`). Os dados ficam salvos no volume `pgdata`.

> Não tem Docker? Instale o PostgreSQL nativo e ajuste `DATABASE_URL` em
> `server/.env`.

### 2. Backend (API)

```bash
cd server
npm install
cp .env.example .env       # ajuste JWT_SECRET em produção
npm run migrate            # cria as tabelas
npm run seed -- "Seu Nome" voce@email.com suaSenha admin   # cria o 1º admin
npm run dev                # API em http://localhost:3001
```

### 3. Front-end

Em **outro terminal**, na raiz do projeto:

```bash
npm install
npm run dev                # app em http://localhost:5173
```

Abra http://localhost:5173, clique em **Entrar** e use o e-mail/senha do seed.

## Perfis de acesso

As permissões são validadas na API (JWT) e refletidas na interface:

| Perfil          | Permissões                                                    |
| --------------- | ------------------------------------------------------------- |
| `admin`         | Tudo: dashboard, planilha, cabos, edição e exclusão           |
| `coordenador`   | Dashboard, planilha (leitura + edição), gestão de cabos       |
| `cabo`          | Vê **apenas os próprios** eleitores (via `usuarios.cabo_id`)  |
| `visualizador`  | Dashboard e planilha em modo leitura                          |

O formulário de cadastro (`/cadastro`) e a política de privacidade
(`/privacidade`) são **públicos** — não exigem login.

### Criar mais usuários

Use o mesmo comando de seed com o perfil desejado:

```bash
cd server
npm run seed -- "Maria" maria@email.com senha123 coordenador
```

Para um usuário `cabo`, defina o `cabo_id` dele direto no banco (vinculando ao
registro em `cabos_eleitorais`).

## Funcionalidades

- **Formulário** (`/cadastro`): campos do eleitor, máscara de telefone, link
  personalizado por cabo (`/cadastro?cabo=<id>`), validação, rejeição de
  duplicados (nome + zona + seção) e consentimento LGPD.
- **Planilha** (`/planilha`): tempo real, busca, filtros, ordenação, edição
  inline, exclusão e exportação Excel/CSV.
- **Dashboard** (`/dashboard`): KPIs, gráficos (cidade, zona, bairros, por dia) e
  ranking de cabos (meta vs. realizado).
- **Cabos** (`/cabos`): CRUD, metas e link personalizado com botão de copiar.

## Estrutura

```
src/                 Front-end (React)
  auth/              AuthContext, ProtectedRoute
  hooks/             useEleitores (Socket.io), useCabos
  lib/               api (fetch+JWT), socket, types, constants, format, export
  pages/             Dashboard, Planilha, Cabos, Cadastro, Login, Privacidade
server/              Back-end (Node/Express)
  src/index.js       API + rotas + Socket.io
  src/auth.js        JWT e middlewares de permissão
  src/migrate.js     aplica o schema.sql
  src/seed.js        cria usuários
  schema.sql         tabelas (usuarios, cabos_eleitorais, eleitores)
docker-compose.yml   PostgreSQL
```

## Scripts

Front-end (raiz): `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`.

Backend (`server/`): `npm run dev`, `npm run migrate`, `npm run seed`, `npm start`.

## Pendências

- **Mapa de calor (Leaflet):** requer latitude/longitude no modelo (geocodificar
  endereço/local de votação).
- **Anonimização LGPD sob demanda:** política e consentimento já existem; falta a
  ação de anonimizar/excluir um titular a partir da planilha.
