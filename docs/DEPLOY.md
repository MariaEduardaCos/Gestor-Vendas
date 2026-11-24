# Publicar o ConsultoraSync (Render + Supabase, grátis)

O sistema vira um único endereço (ex.: `https://consultorasync.onrender.com`) que abre no computador e no celular.

- **Render**: roda o servidor e as telas. É grátis e "dorme" depois de 15 minutos sem uso; o primeiro acesso depois disso demora cerca de 1 minuto.
- **Supabase**: guarda o banco (PostgreSQL). É grátis; o projeto é **pausado depois de 7 dias sem nenhum acesso** e volta pelo painel do Supabase (botão "Restore").

Senhas e endereços de banco vão **só** nos painéis do Render e do Supabase, ou no arquivo `packages/server/.env.supabase` deste computador. Nunca no GitHub nem em conversas.

## 1. GitHub (uma vez)

1. Crie um repositório **privado** em https://github.com/new (ex.: `consultorasync`), sem README.
2. Copie o endereço que ele mostra (`https://github.com/SEU-USUARIO/consultorasync.git`) para enviar o código.

## 2. Supabase (uma vez)

1. Crie a conta em https://supabase.com e clique em **New project**.
2. Nome: `consultorasync`. Região: **East US (North Virginia)**, a mesma do Render (região longe deixa cada tela lenta). Crie uma senha forte para o banco e guarde num gerenciador de senhas.
3. Com o projeto pronto, clique em **Connect** (no topo). Na aba de conexão, escolha **Session pooler** (o Render não acessa o endereço "Direct connection").
4. Copie o endereço, que tem este formato, e troque `[YOUR-PASSWORD]` pela senha do passo 2:
   `postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
5. Neste computador, salve o endereço no arquivo `packages/server/.env.supabase` (ele não vai para o GitHub):
   ```
   DATABASE_URL="postgresql://postgres.xxxxxxxx:SENHA@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
   ```

## 3. Criar as tabelas e levar os dados (uma vez, neste computador)

Na pasta `packages/server`:

```bash
set -a; . ./.env.supabase; set +a; npx prisma db push --skip-generate
```

Para levar os seus dados de teste atuais (catálogos da Natura e do Boticário, produtos, pedidos):

```bash
set -a; . ./.env.supabase; set +a; DESTINO_URL="$DATABASE_URL" python3 scripts/copiar-sqlite-para-postgres.py prisma/dev.db
```

O script só preenche tabelas vazias e grava tudo de uma vez (se falhar, nada fica pela metade).

## 4. Render (uma vez)

1. Crie a conta em https://render.com entrando com o GitHub, e autorize o acesso ao repositório.
2. Clique em **New → Blueprint** e escolha o repositório. O Render lê o arquivo `render.yaml` e já preenche tudo.
3. Ele pede o valor de **DATABASE_URL**: cole o endereço do Supabase (o mesmo do passo 2.4).
4. Clique em **Apply**. A primeira publicação leva uns 5 minutos. O `SESSION_SECRET` é gerado sozinho.
5. O endereço do sistema aparece no topo do serviço (`https://consultorasync-xxxx.onrender.com`).

## Depois disso

- Toda vez que o código for enviado ao GitHub (branch `main`), o Render publica a nova versão sozinho.
- No primeiro acesso, use **Criar conta** na tela de entrada. A conta de demonstração não existe em produção.
- O celular abre o mesmo endereço; como é HTTPS, a câmera para ler códigos de barras funciona.
- Tokens opcionais (`COSMOS_TOKEN`, `SI5_TOKEN`) são adicionados em **Environment** no painel do Render.

## Desenvolvimento local (neste computador)

O banco local agora também é PostgreSQL, sem sudo:

```bash
npm run db:local
```

Isso sobe um PostgreSQL na porta 5433 com os dados em `packages/server/.pg-local`. Rode uma vez depois de ligar o computador. Os testes do servidor usam o schema separado `testes` nesse mesmo banco.
