# AgendaCliente

SaaS mobile-first para pequenos negócios de serviços (barbearias, salões, estética,
lash, personal, pet shop) organizarem clientes, agenda, aniversários e mensagens de
WhatsApp.

## Recursos

- Painel com atendimentos do dia, faturamento, aniversariantes e clientes para retorno
- Agenda mensal, semanal e diária com bloqueio de conflito por profissional
- Cadastro de clientes com histórico, tags, consentimento e importação/exportação CSV
- Calendário de aniversários e recuperação de clientes inativos
- Modelos de mensagem com variáveis e envio manual via `wa.me`
- Onboarding em duas etapas, configuração de horários e serviços
- Assinatura de R$ 50/mês com período de implantação de 7 dias e solicitação de acesso
- Dois modos de dados: demonstração local (localStorage) e Supabase com RLS

## Rodando localmente

```bash
npm install
npm run dev
```

Sem variáveis de ambiente o app inicia em **modo demonstração**, com dados de exemplo.

- E-mail: `demo@agendacliente.com`
- Senha: `demo123`

## Modos de dados

| Modo | Como ativar | Persistência |
| --- | --- | --- |
| `demo` | padrão, ou `VITE_DATA_MODE=demo` | localStorage do navegador |
| `supabase` | `VITE_DATA_MODE=supabase` + URL/anon key | Postgres do Supabase |

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-ANON-KEY
VITE_DATA_MODE=supabase
```

Se `VITE_DATA_MODE` não for informado e as duas variáveis do Supabase existirem, o modo
`supabase` é usado automaticamente.

## Configurando o Supabase

1. Crie um projeto no [Supabase](https://supabase.com).
2. No SQL Editor, execute `supabase/migrations/0001_init.sql`.
   - Cria tabelas, índices, constraints, triggers, RLS e o bucket público `logos`.
   - O trigger `handle_new_user` cria negócio, perfil e os 5 modelos padrão no cadastro.
3. Em Authentication, ajuste a URL do site e as redirect URLs para o seu domínio
   (inclusive `/redefinir-senha`).
4. Opcional: execute `supabase/seed.sql` para popular o primeiro negócio com dados de
   demonstração.
5. Preencha o `.env` e rode o app.

### Segurança

- RLS em todas as tabelas de negócio via `business_id = current_business_id()`.
- `current_business_id()` é `security definer` e resolve o negócio pelo perfil do usuário.
- A constraint `appointments_no_overlap` impede dois atendimentos ativos no mesmo
  horário/profissional com `btree_gist`.
- O bucket `logos` é público para leitura; upload/alteração/exclusão só na pasta do
  próprio negócio.
- O cadastro cria o negócio com `trial_ends_at = now() + 7 dias`. A ativação do plano é
  feita pelo botão "Solicitar acesso" (sem gateway de pagamento nesta versão).

## Scripts

```bash
npm run dev       # ambiente de desenvolvimento
npm run build     # typecheck + build de produção
npm run preview   # serve o build
npm run lint      # oxlint
```

## Estrutura

```
src/
  components/   UI, layout e editores compartilhados
  config/       plano, trial, credenciais demo e modo de dados
  context/      sessão, negócio e autenticação
  domain/       regras de negócio (conflitos, aniversários, dashboard, slots)
  hooks/        consultas TanStack Query
  lib/          formatação BR, WhatsApp, CSV, Supabase, query client
  pages/        telas por domínio (auth, clientes, agenda, ...)
  services/     contrato da API + adaptadores demo e Supabase
supabase/
  migrations/   schema, RLS, triggers, storage
  seed.sql      dados de demonstração opcionais
```

## Observações

- Mensagens são abertas manualmente no WhatsApp e registradas em `message_logs`.
- Mensagens de aniversário e retorno exigem consentimento de marketing do cliente.
- A cobrança recorrente (Stripe/Mercado Pago) fica para a próxima etapa; hoje a
  ativação é combinada por contato.
