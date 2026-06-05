# Passo a passo — Colocar o Gestor de Votos no ar

Guia clique-a-clique para publicar o sistema na internet e gerar o link do
formulário pra mandar no WhatsApp. Não precisa saber programar.

**O que vamos usar (tudo grátis):**
- **Neon** → o banco de dados (PostgreSQL)
- **Render** → o servidor da API (o "cérebro")
- **Netlify** → o site (a tela que as pessoas veem)

> Faça **na ordem**. Cada parte gera uma informação que a próxima precisa.
> Separe ~30 minutos. Tenha o GitHub à mão (seu repositório já está lá:
> `luiz-felippee/gestor_de_votos`).

---

## PARTE 1 — Banco de dados (Neon) ⏱️ ~5 min

1. Acesse **https://neon.tech** e clique em **Sign up**. Entre com o **GitHub**
   (mais rápido).
2. Clique em **Create project** (ou **New Project**).
   - **Name:** `gestor-votos` (pode ser qualquer nome)
   - **Region:** escolha a mais perto (ex.: *AWS - São Paulo* se aparecer)
   - Clique em **Create**.
3. Vai aparecer uma caixa **Connection string** com um texto começando com
   `postgresql://...`. Clique no botão de **copiar** 📋.
4. **Cole esse texto num bloco de notas** e guarde. Vamos usar na Parte 2.
   - Ele se parece com:
     `postgresql://usuario:senha@ep-nome-123.sa-east-1.aws.neon.tech/neondb?sslmode=require`

✅ **Pronto a Parte 1** quando você tiver a connection string copiada.

---

## PARTE 2 — API (Render) ⏱️ ~10 min

1. Acesse **https://render.com** → **Get Started** → entre com o **GitHub**.
2. Se pedir, autorize o Render a acessar seus repositórios do GitHub.
3. No painel, clique em **New +** (canto superior direito) → **Blueprint**.
4. Selecione o repositório **`gestor_de_votos`** e clique em **Connect**.
   - O Render lê o arquivo `render.yaml` automaticamente e já entende que é a API.
5. Ele vai mostrar um serviço chamado **gestor-votos-api**. Antes de finalizar,
   role até **Environment Variables** (variáveis de ambiente) e preencha:

   | Nome (Key)       | Valor (Value)                                          |
   | ---------------- | ------------------------------------------------------ |
   | `DATABASE_URL`   | cole a **connection string do Neon** (Parte 1)         |
   | `ADMIN_NAME`     | `Luiz Felipe`                                           |
   | `ADMIN_EMAIL`    | seu e-mail (será seu **login**)                         |
   | `ADMIN_PASSWORD` | **uma senha forte** (será sua **senha** de login)      |
   | `CORS_ORIGIN`    | `*`  (só por enquanto; trocamos na Parte 4)             |

   > `JWT_SECRET` já é gerado sozinho — não precisa mexer.
   > ⚠️ Anote o `ADMIN_EMAIL` e o `ADMIN_PASSWORD` — é com eles que você entra
   > no sistema em produção (NÃO é o `senha123` que usamos no seu PC).

6. Clique em **Apply** / **Create**. O Render começa a construir (leva ~3-5 min).
   Acompanhe os **Logs**; quando aparecer **"API do Gestor de Votos rodando"**,
   terminou.
7. No topo da página do serviço vai ter a **URL da API**, algo como:
   `https://gestor-votos-api.onrender.com`. **Copie e guarde.**
8. **Teste:** abra no navegador essa URL com `/api/health` no final:
   `https://gestor-votos-api.onrender.com/api/health`
   - Deve aparecer: `{"ok":true}` ✅

✅ **Pronto a Parte 2** quando o `/api/health` mostrar `{"ok":true}`.

> 💤 No plano grátis a API "dorme" depois de 15 min parada e demora ~30s pra
> acordar na primeira visita. Isso é normal.

---

## PARTE 3 — Site (Netlify) ⏱️ ~7 min

1. Acesse **https://netlify.com** → **Sign up** → entre com o **GitHub**.
2. Clique em **Add new site** → **Import an existing project** → **GitHub**.
3. Selecione o repositório **`gestor_de_votos`**.
   - As configurações de build (`npm run build`, pasta `dist`) já vêm prontas do
     arquivo `netlify.toml` — **não precisa mudar nada**.
4. **ANTES de clicar em Deploy**, abra **Add environment variables** (ou
   *Show advanced* → *New variable*) e adicione:

   | Key            | Value                                              |
   | -------------- | -------------------------------------------------- |
   | `VITE_API_URL` | a **URL da API do Render** (Parte 2, passo 7)      |

   > ⚠️ Sem barra `/` no final. Ex.: `https://gestor-votos-api.onrender.com`
   > Isso precisa estar definido **antes** do site ser construído.

5. Clique em **Deploy**. Aguarde ~2 min.
6. No topo aparece a URL do site, algo como
   `https://nome-aleatorio-123.netlify.app`. **Copie e guarde.**
   - (Opcional) Em **Site configuration → Change site name** você troca o nome
     pra algo bonito, ex.: `gestor-de-votos-luiz.netlify.app`.

✅ **Pronto a Parte 3** quando você conseguir abrir a URL do Netlify no navegador
e ver a tela de **Entrar**.

---

## PARTE 4 — Ligar o site à API (CORS) ⏱️ ~3 min

Agora que você tem a URL do Netlify, precisa liberar ela na API.

1. Volte no **Render** → abra o serviço **gestor-votos-api**.
2. No menu lateral, clique em **Environment**.
3. Ache a variável **`CORS_ORIGIN`** e clique para editar.
4. Troque o `*` pela **URL do Netlify** (Parte 3), por exemplo:
   ```
   https://gestor-de-votos-luiz.netlify.app
   ```
5. Clique em **Save changes**. O Render vai reiniciar a API sozinho (~1 min).

✅ **Pronto a Parte 4** quando o Render terminar o redeploy.

---

## PARTE 5 — Testar e pegar o link 🎉 ⏱️ ~3 min

1. Abra a **URL do Netlify** no navegador.
2. Clique em **Entrar** e use o **`ADMIN_EMAIL`** e **`ADMIN_PASSWORD`** que você
   definiu no Render (Parte 2).
3. Você entra como **administrador**. Agora:
   - Vá em **Usuários** e cadastre sua equipe (coordenadores, cabos).
   - Vá em **Gestão de Cabos**, cadastre os cabos e clique em **Copiar link** em
     cada um.
4. Esse link é assim:
   `https://gestor-de-votos-luiz.netlify.app/cadastro?cabo=ID-DO-CABO`
   - É **esse** link que você manda no **WhatsApp** dos cabos. Qualquer pessoa
     abre no celular e cadastra eleitores — sem precisar de login. ✅

---

## Atualizações futuras

Sempre que mexermos no código e dermos **`git push`**, **Render e Netlify
publicam a nova versão sozinhos**. Não precisa refazer nada disso.

---

## Se der erro — o que checar

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `/api/health` não abre | API ainda construindo ou caiu | Veja os **Logs** no Render; confira o `DATABASE_URL` |
| Login diz "não foi possível conectar" | `VITE_API_URL` errado no Netlify | Corrija a variável e refaça o deploy do Netlify |
| Login diz "e-mail ou senha inválidos" | Senha digitada ≠ `ADMIN_PASSWORD` | Use exatamente o que está no Render |
| Tela branca / erro de CORS | `CORS_ORIGIN` não bate com a URL do site | Na Parte 4, cole a URL exata do Netlify (com `https://`) |
| Primeira visita demora ~30s | API grátis "acordando" | Normal; espere e recarregue |

> Travou em algum passo? Me diga **em qual parte e número** você está e cole a
> mensagem de erro (ou o log do Render) que eu te ajudo a resolver.
