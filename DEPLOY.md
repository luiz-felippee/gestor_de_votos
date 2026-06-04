# Deploy — Netlify + Neon + Render

Guia para colocar o **Gestor de Votos** na internet, com um link que qualquer
celular abre. Arquitetura:

```
Site (React)  →  Netlify
API (Node)    →  Render
PostgreSQL    →  Neon
```

> Tudo tem camada gratuita. A API no Render (plano free) "dorme" após ~15 min sem
> uso e leva ~30s pra acordar na primeira visita — normal no plano grátis.

---

## Passo 0 — Subir o código no GitHub

Netlify e Render publicam a partir de um repositório Git.

1. Crie um repositório vazio em [github.com](https://github.com/new) (ex.: `gestor-de-votos`).
2. Na raiz do projeto:
   ```bash
   git init
   git add .
   git commit -m "Gestor de Votos"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/gestor-de-votos.git
   git push -u origin main
   ```

> Os arquivos `.env` **não** sobem (estão no `.gitignore`) — as credenciais você
> coloca direto nos painéis de Render/Netlify.

---

## Passo 1 — Banco no Neon

1. Crie conta em [neon.tech](https://neon.tech) → **New Project**.
2. Em **Connection string**, copie a URL (formato
   `postgres://USER:SENHA@ep-xxx.neon.tech/neondb?sslmode=require`).
3. Guarde essa string — vai no Render no próximo passo.

---

## Passo 2 — API no Render

1. Crie conta em [render.com](https://render.com) e conecte seu GitHub.
2. **New +** → **Blueprint** → selecione o repositório (ele lê o `render.yaml`).
   - Se preferir manual: **New +** → **Web Service** → repo → **Root Directory** =
     `backend`, **Build** = `npm install && npx prisma generate && npx prisma db push`,
     **Start** = `npm start`.
3. Em **Environment**, defina as variáveis:

   | Variável         | Valor                                                          |
   | ---------------- | -------------------------------------------------------------- |
   | `DATABASE_URL`   | a connection string do Neon (Passo 1)                          |
   | `JWT_SECRET`     | gerado automaticamente (ou um texto aleatório longo)           |
   | `ADMIN_NAME`     | seu nome                                                       |
   | `ADMIN_EMAIL`    | seu e-mail (será o login admin)                                |
   | `ADMIN_PASSWORD` | uma senha forte                                                |
   | `CORS_ORIGIN`    | deixe `*` por enquanto (ajustamos no Passo 4)                  |

4. **Deploy**. Quando terminar, copie a URL da API (ex.:
   `https://gestor-votos-api.onrender.com`).
5. Teste: abra `SUA_URL/api/health` → deve mostrar `{"ok":true}`.

> O `prisma db push` (no build) cria as tabelas e o `ADMIN_*` cria seu login admin
> automaticamente — sem precisar de terminal no servidor.

---

## Passo 3 — Site no Netlify

1. Crie conta em [netlify.com](https://netlify.com) e conecte seu GitHub.
2. **Add new site** → **Import an existing project** → selecione o repositório.
   - As configurações de build já vêm do `netlify.toml`
     (comando `npm run build`, pasta `dist`, e o redirect de SPA).
3. Antes de concluir, abra **Site configuration → Environment variables** e adicione:

   | Variável       | Valor                                                 |
   | -------------- | ----------------------------------------------------- |
   | `VITE_API_URL` | a URL da API do Render (Passo 2, **sem barra final**) |

   > Importante: defina a variável **antes do build** (ou refaça o deploy depois
   > de adicioná-la), pois o Vite lê `VITE_API_URL` no momento do build.
4. **Deploy**. Copie a URL do site (ex.: `https://gestor-de-votos.netlify.app`).

---

## Passo 4 — Ligar os dois (CORS)

1. Volte no **Render** → seu serviço → **Environment**.
2. Troque `CORS_ORIGIN` de `*` para a URL do Netlify:
   ```
   https://gestor-de-votos.netlify.app
   ```
   (pode incluir o local também, separando por vírgula:
   `http://localhost:5173,https://gestor-de-votos.netlify.app`)
3. Salve → o Render faz redeploy.

---

## Passo 5 — Testar e pegar o link

1. Abra a URL do Netlify → **Entrar** com o e-mail/senha do `ADMIN_*`.
2. Vá em **Cabos**, cadastre os cabos e clique em **Copiar link** em cada um.
3. Esse link (ex.:
   `https://gestor-de-votos.netlify.app/cadastro?cabo=<id>`) é o que você manda no
   **WhatsApp** — funciona em qualquer celular. 🎉

---

## Atualizações futuras

Toda vez que você fizer `git push`, **Netlify e Render publicam sozinhos** a nova
versão. Depois do primeiro deploy, pode remover `AUTO_MIGRATE` do Render se quiser
controlar as migrações manualmente.
