# Prazos de Licenciamento — React + API + Supabase

Versão "app de verdade" do gestor que hoje roda como artifact do Claude (`prazos-licenciamento.html`).

```
frontend/   React 18 + Vite + TypeScript  (tela, login)
backend/    Node + Express + TypeScript   (API REST /api, validação com zod)
supabase/   migrations SQL                (banco Postgres no Supabase)
```

## Como as peças conversam

1. O usuário entra com e-mail e senha pelo **Supabase Auth** (no frontend).
2. O frontend chama a **API** (`/api/...`) mandando o token do usuário.
3. A API consulta o Supabase **como esse usuário**, então as regras de acesso (RLS) do banco valem sempre:
   - quem não está em `membros` não vê nada;
   - `leitor` só vê;
   - `editor` cadastra, edita e exclui.

## Banco (já criado no projeto Supabase)

- `public.licencas`: obra, tipo (licença/etapa), ordem, fase, órgão, protocolo, status, início (`data_protocolo`), duração, término (`vencimento`), responsável, observações, datas de criação/edição.
- `public.membros`: quem pode acessar e com qual papel.

SQL em [supabase/migrations](supabase/migrations).

## Rodar localmente

Pré-requisito: **Node.js 20 LTS ou mais novo** (https://nodejs.org).

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001 (o Vite encaminha `/api` para ela)

Os arquivos `backend/.env` e `frontend/.env.local` já vêm preenchidos com a URL e a chave **publicável** do projeto (é pública por natureza; a segurança fica nas policies do banco).

## Primeiro acesso

1. No painel do Supabase: **Authentication → Users → Add user** (e-mail + senha).
2. Libere o usuário no gestor (SQL Editor):

```sql
insert into public.membros (user_id, nome, papel)
select id, 'Seu nome', 'editor' from auth.users where email = 'email@exemplo.com';
```

3. Recomendado: em **Authentication → Providers → Email**, desligue "Allow new users to sign up", para só quem você criar conseguir entrar.

## API

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/health` | status da API (sem login) |
| GET | `/api/me` | usuário logado e papel |
| GET | `/api/licencas` | lista os processos |
| POST | `/api/licencas` | cria (término = início + duração, calculado no servidor) |
| PUT | `/api/licencas/:id` | atualiza |
| DELETE | `/api/licencas/:id` | exclui |

## Pendências

- **Importação**: feita em 12/11/2026 a partir de `cronograma da burocracia.xlsx` (aba "geral"), 270 registros. O conversor é `scripts/importar-cronograma.mjs` (gera JSON e SQL; as regras estão no topo do arquivo). Rodar de novo **duplica** os registros: limpe a tabela antes.
- **Exportar CSV**: existia no artifact; ainda não portado.
- **Alerta do Supabase Advisor**: as funções `public.is_membro()` e `public.is_editor()` (SECURITY DEFINER) ficam chamáveis via `/rest/v1/rpc`. Só retornam se o próprio usuário é membro/editor, então o risco é baixo, mas o ideal é movê-las para um schema não exposto.
