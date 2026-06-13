# PLANO DE EXECUÇÃO — Sistema de Logística e Controle de Frota

> Este documento é o **roteiro de implementação** do projeto descrito em `CLAUDE.md`.
> Ele divide o sistema em **fases incrementais**, cada uma entregando uma "fatia vertical"
> (banco + backend + frontend + testes) testável isoladamente.
>
> Use os checkboxes (`- [ ]`) para acompanhar o progresso. Cada fase referencia a seção
> correspondente do `CLAUDE.md` — ao implementar uma regra, cite essa seção no código
> (ex: `// regra da seção 4.4`), conforme item 7.7 do `CLAUDE.md`.

---

## 1. Estratégia Geral

1. **Ordem = dependências de dados.** Módulos que são "tabelas mestras" (usuários, veículos,
   motoristas, rotas, unidades) vêm antes dos módulos operacionais que os referenciam
   (diário de uso, viagens, abastecimento...). Dashboards, financeiro, metas e relatórios
   vêm por último porque **agregam** dados de todos os outros módulos.
2. **Cada fase é uma entrega vertical completa**: schema Prisma + migration, módulo NestJS
   (DTOs, service, controller, guards), testes Jest das regras críticas, e as telas React
   correspondentes. Nada de "backend de tudo primeiro, frontend depois".
3. **Migrations incrementais.** Nunca escrever o `schema.prisma` inteiro de uma vez. Cada
   fase adiciona/altera apenas os models que precisa e gera sua própria migration
   (`prisma migrate dev --name <nome-da-fase>`).
4. **Segurança e RBAC desde a Fase 1.** Guards, validação, soft delete e auditoria
   (`created_by`/`updated_by`) são padrão em **todo** módulo a partir da Fase 2 — não é
   algo para "adicionar depois".
5. **Frontend acompanha o backend.** Ao final de cada fase (a partir da Fase 1) deve existir
   pelo menos uma tela funcional consumindo a API real (sem mocks). Se houver subagente de
   frontend configurado em `.claude/agents/`, as tarefas de UI dessas fases devem ser
   delegadas a ele, mantendo consistência com Tailwind + shadcn/ui (ver seção 2 e 7.4 do
   `CLAUDE.md`).
6. **Git/commits.** Um branch por fase (ou por módulo dentro da fase), commits seguindo
   Conventional Commits (`feat:`, `fix:`, `test:`, etc., conforme seção 6 do `CLAUDE.md`).
   PR só é "mergeável" quando o checklist de DoD da fase (Apêndice B) estiver 100%.

---

## 2. Stack Consolidada (decisões fechadas)

Decisões que o `CLAUDE.md` deixava abertas ("X ou Y") e que foram fechadas para manter
consistência em todo o projeto:

| Tema                                                        | Decisão                                           | Observação                                                       |
| ----------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| Validação (backend)                                         | **class-validator + class-transformer**           | Idiomático no NestJS, integra nativamente com `@nestjs/swagger`. |
| Validação (frontend)                                        | **Zod + React Hook Form**                         | Conforme seção 2, mantido no frontend (camada própria).          |
| Jobs agendados simples (alertas diários, viagens atrasadas) | **@nestjs/schedule (`@Cron`)**                    | Roda dentro do próprio backend, sem infra extra.                 |
| Jobs pesados (geração de relatórios PDF/Excel)              | **BullMQ + Redis**                                | Redis já está na stack (docker-compose); evita bloquear a API.   |
| Geração de PDF                                              | **pdf-lib**                                       | Programático, leve, sem precisar de Chromium no container.       |
| Geração de Excel                                            | **ExcelJS**                                       | Conforme seção 2.                                                |
| CSV                                                         | Geração nativa (stream simples, sem libs extras)  | Casos simples de tabela → CSV.                                   |
| Logs estruturados                                           | **Pino (`nestjs-pino`)**                          | Alta performance, JSON estruturado; rotação via `pino-roll`.     |
| Autenticação                                                | JWT (access curto + refresh em cookie `httpOnly`) | Conforme seção 5.                                                |
| Banco                                                       | PostgreSQL + Prisma                               | Conforme seção 2.                                                |

---

## 3. Mapa de Fases e Dependências

```
Fase 0  → Setup & Infraestrutura
Fase 1  → Auth + Usuários + RBAC                    (base de tudo)
Fase 2  → Cadastros Base: Unidades, Motoristas,
          Veículos, Rotas                            (depende de 1)
Fase 3  → Controle Diário de Uso (núcleo)            (depende de 2)
Fase 4  → Viagens (Trips)                            (depende de 2)
Fase 5  → Abastecimento (Fuel)                       (depende de 2)
Fase 6  → Manutenção                                 (depende de 2)
Fase 7  → Ocorrências                                (depende de 2)
Fase 8  → Envios / Protocolo (Shipments)             (depende de 1, Unidades)
Fase 9  → Alertas Automáticos                        (depende de 2, 4, 6)
Fase 10 → Dashboard e Indicadores                    (depende de 3, 4, 5, 7)
Fase 11 → Financeiro                                 (depende de 2, 5, 6)
Fase 12 → Metas e Comissão                           (depende de 5, 11)
Fase 13 → Relatórios                                 (depende de 3-12)
Fase 14 → Segurança, Auditoria e Hardening Final     (transversal, revisão final)
Fase 15 → Deploy e Produção                          (final)
```

As fases 3 a 8 são paralelizáveis entre si (todas dependem só da Fase 2), mas recomenda-se
seguir a ordem numérica para manter o foco em um módulo por vez.

---

## 4. Fases Detalhadas

### Fase 0 — Fundação e Setup do Ambiente

**Objetivo:** ter o ambiente de desenvolvimento completo rodando (Docker, Postgres, Redis,
backend NestJS, frontend Vite), com qualidade de código e observabilidade configuradas
desde o início.

#### 0.1 Estrutura de repositório

- [x] Criar `/backend` e `/frontend` conforme estrutura da seção 3 do `CLAUDE.md`
- [x] Inicializar repositório Git (se ainda não houver) + `.gitignore` raiz
      (`node_modules`, `dist`, `.env`, `storage/`, `*.log`)
- [x] Copiar `.env` atual para `.env.example`, removendo valores sensíveis reais
      (senhas, secrets) e mantendo apenas placeholders

#### 0.2 Backend — bootstrap NestJS

- [x] `npx @nestjs/cli new backend`
- [x] Instalar dependências principais:
  - Prisma: `prisma`, `@prisma/client`
  - Auth: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `cookie-parser`
  - Validação: `class-validator`, `class-transformer`
  - Docs: `@nestjs/swagger`
  - Segurança: `helmet`, `@nestjs/throttler`
  - Logs: `nestjs-pino`, `pino-http`, `pino-pretty` (dev), `pino-roll` (rotação)
  - Jobs: `@nestjs/schedule`, `@nestjs/bullmq`, `bullmq`
  - Relatórios: `exceljs`, `pdf-lib`
  - E-mail: `@nestjs-modules/mailer`, `nodemailer`
- [x] Criar estrutura de pastas conforme seção 3:
      `src/modules/*`, `src/common/{guards,decorators,filters,interceptors,utils}`, `src/prisma`
- [x] Configurar `main.ts`:
  - `helmet()`
  - CORS com lista explícita de origens via `FRONTEND_URL`
  - `ValidationPipe` global (`whitelist: true, forbidNonWhitelisted: true, transform: true`)
  - Swagger em `/api/docs` (`@nestjs/swagger`)
  - Logger Pino global (substitui logger padrão do Nest)
  - Cookie parser (para refresh token httpOnly)
- [x] Módulo `health` com `GET /health` (status da API + conexão com banco)

#### 0.3 Prisma

- [x] `npx prisma init` (datasource `postgresql`, usa `DATABASE_URL` do `.env`)
- [x] Configurar `PrismaService` (módulo global, `onModuleInit`/`onModuleDestroy`)
- [x] Definir convenção: tabelas/colunas em `snake_case` via `@@map`/`@map` (seção 6),
      mas atributos do model em `camelCase`
- [x] Criar enum `Role` e model `User` mínimo (necessário para a Fase 1) e rodar
      `npx prisma migrate dev --name init`

#### 0.4 Frontend — bootstrap Vite

- [x] `npm create vite@latest frontend -- --template react-ts`
- [x] Instalar: `tailwindcss postcss autoprefixer`, shadcn/ui (`npx shadcn@latest init`),
      `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`,
      `react-router-dom`, `recharts`, `axios`
- [x] Criar estrutura `src/{pages,components,hooks,services,lib,types}` (seção 3)
- [x] Configurar cliente HTTP (`src/lib/api.ts`) com `axios`, `baseURL` via
      `VITE_API_URL`, e interceptor preparado para refresh de token (ativado na Fase 1)
- [x] Layout base (sidebar + header) com placeholders de navegação por módulo

#### 0.5 Docker & docker-compose

- [x] `backend/Dockerfile` (multi-stage: build → runtime)
- [x] `frontend/Dockerfile` (dev: Vite; build: estático servido por Nginx — usado na Fase 15)
- [x] `docker-compose.yml` na raiz com serviços: `postgres`, `redis`, `backend`, `frontend`
  - Volumes nomeados para dados do Postgres e para `storage/reports`
  - Variáveis lidas do `.env`
- [x] `docker compose up` sobe tudo sem erros — confirmado (postgres e redis
      `Healthy`, backend e frontend iniciados)

#### 0.6 Qualidade de código

- [x] ESLint + Prettier configurados em `backend` e `frontend` (regras alinhadas)
- [x] Husky + lint-staged (pre-commit: lint + format)
- [x] (Opcional) commitlint para reforçar Conventional Commits

#### 0.7 Subagente de frontend (opcional)

- [ ] Se for usar subagente dedicado, criar `.claude/agents/frontend.md` com instruções
      de design system (Tailwind + shadcn/ui), para ser referenciado a partir da Fase 1

**Critérios de aceite (DoD Fase 0):**

- [x] `docker compose up` sobe Postgres, Redis, backend e frontend sem erro —
      confirmado (todos os 4 serviços no ar via `docker compose up --build`)
- [x] `GET /health` retorna 200 — confirmado (`{"status":"ok","database":"up",...}`
      contra o stack via Docker, com Postgres acessível via `DATABASE_URL`)
- [x] Swagger acessível em `/api/docs` — confirmado (200 OK)
- [x] Frontend acessível em `localhost:5173` exibindo layout base — confirmado (200 OK,
      build de produção também passa)
- [x] `npx prisma migrate dev` funciona e cria a tabela `users` — confirmado
      (`docker compose exec backend npx prisma migrate dev --name init` aplicou
      a migration `20260612192048_init`)
- [x] Lint/format rodando sem erros em ambos os projetos — confirmado
      (`npm run lint` limpo em backend e frontend; Husky pre-commit + commitlint testados)

---

### Fase 1 — Autenticação, Usuários e RBAC (seção 4.1)

**Objetivo:** sistema de login funcional para os 4 perfis (Administrador, Coordenação,
Motorista, Financeiro), com guards reutilizáveis por todo o restante do projeto.

#### Prisma

- [x] `enum Role { ADMIN COORDENACAO MOTORISTA FINANCEIRO }` (UPPER_SNAKE_CASE, seção 6)
- [x] `model User`: `id, name, email (unique), passwordHash, role, isActive,
failedLoginAttempts, lockedUntil, createdAt, updatedAt, deletedAt` (soft delete)
- [x] Migration `add_users_and_roles`

#### Backend

- [x] `common/utils`: helper de hash/verify com bcrypt (`BCRYPT_ROUNDS` do `.env`, mínimo 10)
- [x] **Módulo `auth`**
  - `POST /auth/login` — valida credenciais, incrementa `failedLoginAttempts` em caso de
    erro, bloqueia conta (`lockedUntil`) após N tentativas (configurável via env)
  - `POST /auth/refresh` — lê refresh token do cookie `httpOnly`, emite novo access token
  - `POST /auth/logout` — invalida cookie de refresh
  - Access token JWT curto (`JWT_EXPIRES_IN`), refresh token (`JWT_REFRESH_EXPIRES_IN`) em
    cookie `httpOnly; secure; sameSite=strict`
  - `JwtStrategy` (Passport) + `JwtAuthGuard`
  - `@nestjs/throttler` aplicado em `/auth/login` (rate limiting)
- [x] **Common**
  - `@Roles(...roles: Role[])` decorator + `RolesGuard`
  - `@CurrentUser()` decorator (extrai usuário do request)
  - `GlobalExceptionFilter` retornando mensagens padronizadas em pt-BR
  - Interceptor de auditoria base (preenche `createdBy`/`updatedBy` — usado a partir da Fase 2)
- [x] **Módulo `users`**
  - CRUD (somente `ADMIN`), nunca retorna `passwordHash`
  - Soft delete (`deletedAt`)
  - Endpoint `GET /users/me` (perfil do usuário autenticado)

#### Frontend

- [x] Tela de login (shadcn/ui `Form` + RHF + Zod), mensagens de erro em pt-BR
- [x] `AuthContext`/store: access token em memória, refresh automático via interceptor axios
- [x] `ProtectedRoute` + verificação de `role` por rota (React Router)
- [x] Layout: menu lateral exibe apenas itens permitidos para o perfil logado
- [x] Tela `Usuários` (CRUD, somente visível para `ADMIN`)

#### Testes (Jest)

- [x] Hash/verify de senha
- [x] Bloqueio de conta após N tentativas falhas e desbloqueio após expiração
- [x] `RolesGuard` nega acesso para perfil não permitido
- [x] Geração/validação de access e refresh tokens

**Critérios de aceite:**

- [x] Login funciona para os 4 perfis com tokens corretos
- [x] Rota protegida por `@Roles(Role.ADMIN)` retorna 403 para outros perfis
- [x] Refresh token renova sessão sem novo login
- [x] Lockout após N tentativas funciona e é configurável via `.env`

---

### Fase 2 — Cadastros Base: Unidades, Motoristas, Veículos, Rotas (seções 4.2, 4.3)

**Objetivo:** ter todas as "tabelas mestras" que os módulos operacionais (Fases 3-8) vão
referenciar.

#### Prisma

- [x] `model Unit` (unidades de destino dos envios — usado também na Fase 8): `id, name,
address, active, createdAt, updatedAt`
- [x] `model Route`: `id, name, origin, destination, estimatedDistanceKm,
estimatedDurationMinutes, active` — `estimatedDurationMinutes` é usado depois pelo
      job de viagens atrasadas (Fase 4)
- [x] `model Vehicle`: `id, plate (unique), fuelType (enum), tankCapacityLiters,
yearModel, mainRouteId, acquisitionValue, usefulLifeMonths, residualValue,
currentKm, active, deletedAt, createdBy, updatedBy, createdAt, updatedAt` — campos de
      vencimento (`licensingExpiration`, `insuranceExpiration`) entram aqui mas os alertas
      só são implementados na Fase 9
- [x] `model Driver`: `id, name, position, vehicleId (nullable), currentKm,
defaultRouteId (nullable), cnhExpiration, userId (nullable, FK para User — login do
motorista), active, deletedAt, createdBy, updatedBy, createdAt, updatedAt`
- [x] Migration `add_units_routes_vehicles_drivers`

#### Backend

- [x] **Módulo `units`** — CRUD simples (`ADMIN`, `COORDENACAO`)
- [x] **Módulo `routes`** — CRUD simples (`ADMIN`, `COORDENACAO`)
- [x] **Módulo `vehicles`**
  - CRUD com soft delete
  - Validador de placa (regex Mercosul `AAA0A00` e antigo `AAA0000`) — DTO custom validator
  - Service `calculateMonthlyDepreciation()`:
    `(acquisitionValue - residualValue) / usefulLifeMonths`
  - Endpoint que retorna depreciação calculada junto do veículo
- [x] **Módulo `drivers`**
  - CRUD com soft delete, vínculo com `vehicleId`/`defaultRouteId`
  - Endpoint de histórico (placeholder agregando viagens/ocorrências/abastecimentos —
    populado conforme Fases 4, 5, 7 forem concluídas)
  - Se `userId` setado, motorista usa essas credenciais para login (perfil `MOTORISTA`)

#### Frontend

- [x] Páginas de listagem (DataTable shadcn) + formulário (Dialog/Sheet) para:
      Unidades, Rotas, Veículos, Motoristas
- [x] Validação de placa também no frontend (Zod regex), espelhando o backend
- [x] Exibição da depreciação mensal calculada na tela de detalhes do veículo

#### Testes (Jest)

- [x] Validador de placa: casos válidos/inválidos (Mercosul e antigo)
- [x] Cálculo de depreciação mensal (casos de borda: vida útil 0/negativa → erro)
- [x] Soft delete: registro não aparece em listagens padrão mas permanece no banco

**Critérios de aceite:**

- [x] CRUDs completos e protegidos por `@Roles`
- [x] Soft delete funcional em `vehicles` e `drivers`
- [x] Depreciação mensal calculada corretamente e exibida no frontend

---

### Fase 3 — Controle Diário de Uso da Frota (seção 4.4) — núcleo do sistema

**Objetivo:** registrar saída/retorno diário de veículos, com cálculos automáticos e
validações que alimentam todos os indicadores futuros.

#### Prisma

- [x] `model DailyLog`: `id, vehicleId, driverId, routeId, departureAt, returnAt
(nullable), startKm, endKm (nullable), kmDriven (nullable), totalDurationMinutes
(nullable), avgSpeedKmh (nullable), observations, status (enum: EM_ANDAMENTO,
FINALIZADO), createdBy, updatedBy, createdAt, updatedAt`
- [x] Migration `add_daily_logs`

#### Backend — Módulo `daily-logs`

- [x] `POST /daily-logs` (iniciar saída): valida que não existe registro `EM_ANDAMENTO`
      para o mesmo `vehicleId` → senão `409 Conflict`
- [x] `PATCH /daily-logs/:id/return` (registrar retorno):
  - Valida `endKm >= startKm`, senão `422 Unprocessable Entity` (regra explícita da seção 4.4)
  - Calcula automaticamente: `kmDriven = endKm - startKm`,
    `totalDurationMinutes = returnAt - departureAt`,
    `avgSpeedKmh = kmDriven / (totalDurationMinutes / 60)`
  - Atualiza `vehicle.currentKm = endKm`
  - Marca `status = FINALIZADO`
- [x] `GET /daily-logs` — histórico com filtros por veículo, motorista, rota, período
- [x] Guard: perfil `MOTORISTA` só vê/edita registros do próprio `driverId`

#### Frontend

- [x] Tela "Saída/Retorno" — fluxo operacional rápido (registrar saída; depois registrar
      retorno do registro em andamento)
- [x] Tela de histórico com filtros (data, veículo, motorista, rota) e colunas calculadas
      (KM rodado, duração, velocidade média)

#### Testes (Jest)

- [x] Rejeita `endKm < startKm` com 422
- [x] Bloqueia novo registro `EM_ANDAMENTO` se já existir um para o mesmo veículo
- [x] Cálculo de `kmDriven`, `totalDurationMinutes`, `avgSpeedKmh` com casos normais e de
      borda (duração zero, etc.)
- [x] `vehicle.currentKm` é atualizado corretamente ao finalizar

**Critérios de aceite:**

- [x] Todas as regras da seção 4.4 implementadas e testadas
- [x] Frontend reflete em tempo real o status "em andamento"/"finalizado"

---

### Fase 4 — Sistema de Viagens (Trips) (seção 4.5)

**Objetivo:** controlar viagens com status e detecção automática de atrasos.

#### Prisma

- [x] `model Trip`: `id, vehicleId, driverId, routeId, status (enum: EM_ANDAMENTO,
FINALIZADA, ATRASADA), destination, startKm, endKm (nullable), startedAt,
finishedAt (nullable), createdBy, updatedBy, createdAt, updatedAt`
- [x] Migration `add_trips`

#### Backend — Módulo `trips`

- [x] `POST /trips` — cria viagem associando veículo + motorista + rota, `status =
EM_ANDAMENTO`, `startKm` informado
- [x] `PATCH /trips/:id/finish` — valida `endKm >= startKm`, define `finishedAt`,
      `status = FINALIZADA`
- [x] `GET /trips` — histórico completo por motorista/veículo, com filtro de status
- [x] **Job agendado** (`@Cron`, a cada X minutos): busca `Trip` com `status =
EM_ANDAMENTO` cujo `startedAt + route.estimatedDurationMinutes < now()` e atualiza
      para `status = ATRASADA`
- [x] Guard: perfil `MOTORISTA` só vê/opera as próprias viagens

#### Frontend

- [x] Tela de viagens (lista ou kanban por status: Em andamento / Finalizada / Atrasada)
- [x] Ação "Iniciar viagem" / "Encerrar viagem" (com input de KM devolução)
- [x] Indicador visual (badge vermelho) para viagens `ATRASADA`

#### Testes (Jest)

- [x] Encerramento rejeita `endKm < startKm`
- [x] Job de atraso: viagem além do tempo estimado da rota é marcada `ATRASADA`
      (usar fake timers / datas mockadas)
- [x] Viagem finalizada a tempo nunca é marcada como atrasada

**Critérios de aceite:**

- [x] Transições de status corretas (`EM_ANDAMENTO → FINALIZADA` /
      `EM_ANDAMENTO → ATRASADA`)
- [x] Job roda automaticamente e é idempotente (não reprocessa viagens já finalizadas)

---

### Fase 5 — Controle de Abastecimento (seção 4.6)

**Objetivo:** registrar abastecimentos com cálculo automático de consumo e custo.

#### Prisma

- [x] `model Fuel`: `id, vehicleId, driverId, liters, amountPaid, currentKm, fuelType
(enum), date, consumptionKmL (nullable), costPerKm (nullable), createdBy,
updatedBy, createdAt, updatedAt`
- [x] Migration `add_fuel`

#### Backend — Módulo `fuel`

- [x] `POST /fuel`:
  - Rejeita se `currentKm` < último `currentKm` registrado para o veículo (404/422)
  - Valida que `fuelType` é compatível com `vehicle.fuelType`
  - Calcula:
    - `consumptionKmL = (currentKm - kmDoAbastecimentoAnterior) / liters`
    - `costPerKm = amountPaid / (currentKm - kmDoAbastecimentoAnterior)`
  - Atualiza `vehicle.currentKm` se este abastecimento for o mais recente
- [x] `GET /fuel/indicators`:
  - Média KM/L por veículo
  - Veículo mais econômico / mais caro
  - Gasto mensal (total e por veículo)

#### Frontend

- [x] Tela de registro de abastecimento (formulário)
- [x] Cards de indicadores + gráfico (Recharts) de consumo por veículo / gasto mensal

#### Testes (Jest)

- [x] Rejeita `currentKm` menor que o último registrado
- [x] Valida incompatibilidade de tipo de combustível
- [x] Cálculo de `consumptionKmL` e `costPerKm` (incluindo primeiro abastecimento sem
      anterior — não deve calcular, deve retornar `null`)

**Critérios de aceite:**

- [x] Todas as regras da seção 4.6 implementadas e testadas
- [x] Indicadores corretos com dados de seed

---

### Fase 6 — Controle de Manutenção (seção 4.7)

**Objetivo:** histórico e agenda de manutenções, preparando os campos que a Fase 9
(Alertas) vai consumir.

#### Prisma

- [x] `model Maintenance`: `id, vehicleId, type (enum: PREVENTIVA, CORRETIVA), km, cost,
description, scheduledDate (nullable), scheduledKm (nullable), performedDate
(nullable), createdBy, updatedBy, createdAt, updatedAt`
- [x] Campos adicionais em `Vehicle` (alterar via migration): `nextOilChangeKm,
nextOilChangeDate, nextTireChangeKm, nextTireChangeDate, nextReviewKm,
nextReviewDate` (todos nullable) — usados pelos alertas (Fase 9)
- [x] Migration `add_maintenance_and_vehicle_schedule_fields`

> Nota: além de `type` (PREVENTIVA/CORRETIVA), foi adicionado o enum
> `MaintenanceCategory` (TROCA_OLEO, TROCA_PNEUS, REVISAO_GERAL, OUTROS) para
> determinar qual campo `next*` do `Vehicle` deve ser recalculado ao concluir
> a manutenção.

#### Backend — Módulo `maintenance`

- [x] CRUD de manutenções (histórico por veículo) — `create` + `findAll` (com filtros
      por veículo, tipo, categoria e período), seguindo o mesmo escopo do módulo `fuel`
- [x] Ao registrar manutenção concluída, atualizar os campos `next*` do `Vehicle`
      correspondentes ao tipo realizado (ex: troca de óleo → recalcula `nextOilChangeKm`/`Date`
      com base em `KM_ALERT_OIL_CHANGE`/`KM_ALERT_MAINTENANCE` do `.env`)
- [x] `GET /maintenance/schedule` — agenda (próximas manutenções por data/KM, ordenadas
      por proximidade)

#### Frontend

- [x] Tela de histórico de manutenção por veículo
- [x] Tela de agenda (lista de próximas manutenções, ordenada por urgência)

#### Testes (Jest)

- [x] Atualização dos campos `next*` do veículo após registrar manutenção
- [x] Cálculo da agenda (ordenação por proximidade de data/KM)

**Critérios de aceite:**

- [x] Histórico funcional por veículo
- [x] Campos `next*` do `Vehicle` corretamente atualizados — base para a Fase 9

---

### Fase 7 — Controle de Ocorrências (seção 4.8)

**Objetivo:** registrar ocorrências e calcular indicadores de segurança/operação.

#### Prisma

- [x] `model Incident`: `id, vehicleId, driverId, category, type, severity (enum:
BAIXA, MEDIA, ALTA, CRITICA), responsible, cost (nullable), observations, date,
createdBy, updatedBy, createdAt, updatedAt`
- [x] Migration `add_incidents`

> Nota: além de `severity`, foram adicionados os enums `IncidentCategory` (TRANSITO,
> SINISTRO, MECANICA, OPERACIONAL, OUTROS) e `IncidentType` (MULTA, ACIDENTE, PANE,
> ATRASO, DANO_VEICULO, OUTROS) para classificar a ocorrência de forma estruturada,
> permitindo agrupamentos e filtros mais ricos do que um único campo livre.

#### Backend — Módulo `incidents`

- [x] CRUD de ocorrências
- [x] `GET /incidents/indicators`:
  - Ocorrências por motorista
  - Ocorrências por veículo
  - Índice ocorrências/KM rodado (usa soma de `DailyLog.kmDriven` ou `Trip` no período)

#### Frontend

- [x] Tela de registro/listagem de ocorrências (filtro por veículo, motorista, categoria,
      gravidade, período)
- [x] Cards/gráficos de indicadores

#### Testes (Jest)

- [x] Cálculo do índice ocorrências/KM (incluindo divisão por zero quando não há KM
      rodado no período)

**Critérios de aceite:**

- [x] CRUD completo e indicadores corretos com dados de seed

---

### Fase 8 — Módulo de Envios / Protocolo (seção 4.9)

**Objetivo:** envio de itens entre unidades com protocolo único gerado de forma atômica.

#### Prisma

- [x] `model Shipment`: `id, protocolNumber (unique), destinationUnitId, items (Json),
senderId, transporterId (nullable), observations, status (enum: PENDENTE,
EM_TRANSITO, ENTREGUE, CANCELADO), createdBy, createdAt, updatedAt`
- [x] `model ShipmentStatusHistory`: `id, shipmentId, status, changedAt, changedBy,
notes (nullable)` — timeline de movimentações
- [x] Sequence/contador atômico para gerar `protocolNumber` no formato `AAAAMMDD-SEQ`
      (ex: tabela `protocol_counters(date, last_seq)` atualizada via transação com
      `SELECT ... FOR UPDATE`, ou `Prisma.$transaction` com `UPDATE ... RETURNING`)
- [x] Migration `add_shipments`

> Nota: o contador atômico foi implementado como `model ProtocolCounter { date (PK),
lastSeq }`, incrementado via `INSERT ... ON CONFLICT (date) DO UPDATE SET last_seq =
protocol_counters.last_seq + 1 RETURNING last_seq` (`$queryRaw`), garantindo
> atomicidade em uma única instrução SQL sem `SELECT ... FOR UPDATE` explícito.

#### Backend — Módulo `shipments`

- [x] `POST /shipments`:
  - Gera `protocolNumber` de forma atômica (sem colisão sob concorrência)
  - `status` inicial = `PENDENTE`, cria primeira entrada em `ShipmentStatusHistory`
- [x] `PATCH /shipments/:id/status` — atualiza status (`PENDENTE → EM_TRANSITO →
ENTREGUE` ou `CANCELADO`), grava nova entrada na timeline
- [x] `GET /shipments/:protocolNumber` — detalhes + timeline completa
- [x] `GET /shipments` — listagem com filtro por status/unidade/período

> Nota: acesso ao módulo restrito a `ADMIN`/`COORDENACAO` (mesmo padrão de RBAC da
> Fase 6), seguindo a recomendação da Fase 14 de nunca deixar endpoint sem `@Roles(...)`.

#### Frontend

- [x] Tela de criação de envio (seleção de unidade destino, itens, responsáveis,
      observações)
- [x] Listagem com filtro por status
- [x] Tela de detalhes com timeline visual de status

#### Testes (Jest)

- [x] Geração de protocolo: formato correto (`AAAAMMDD-SEQ`)
- [x] **Teste de concorrência**: N criações simultâneas geram N protocolos únicos sem
      colisão
- [x] Transições de status válidas/inválidas e registro correto na timeline

**Critérios de aceite:**

- [x] Protocolos únicos garantidos mesmo sob concorrência (testado) — validado tanto
      no Jest (mock, 5 criações paralelas) quanto via curl contra o Postgres real
      (10 requisições `POST /shipments` simultâneas geraram protocolos
      `20260613-0003`..`20260613-0012`, todos únicos e sequenciais)
- [x] Timeline completa e correta por protocolo — confirmado via curl
      (`GET /shipments/:protocolNumber` retorna `statusHistory` com cada transição)
      e via Playwright (timeline visual exibindo Pendente → Em trânsito)

---

### Fase 9 — Alertas Automáticos (Job Agendado Diário) (seção 4.10)

**Objetivo:** job diário que verifica vencimentos e gera notificações in-app (+ e-mail
opcional).

#### Prisma

- [x] `model Alert`: `id, type (enum: LICENSING, INSURANCE, CNH, REVIEW, OIL_CHANGE,
TIRE_CHANGE, TRIP_DELAYED), referenceType, referenceId, message, severity (enum:
INFO, AVISO, CRITICO), dueDate (nullable), status (enum: PENDENTE, ENVIADO, LIDO),
targetRole (nullable), targetUserId (nullable), createdAt`
- [x] Campos de vencimento em `Vehicle` (`licensingExpiration`, `insuranceExpiration`) e
      em `Driver` (`cnhExpiration`) — já existiam de fases anteriores
- [x] Migration `add_alerts`

#### Backend — Módulo `alerts`

- [x] `@Cron` diário (configurável via `ALERT_CRON_EXPRESSION`, default `0 6 * * *`):
  - Para cada `Vehicle`: verifica `licensingExpiration`, `insuranceExpiration`,
    `nextOilChangeKm/Date`, `nextTireChangeKm/Date`, `nextReviewKm/Date` — gera `Alert`
    nos limiares **30/15/7 dias** antes (ou KM equivalente)
  - Para cada `Driver`: verifica `cnhExpiration` (mesmos limiares)
  - Para `Trip` com `status = ATRASADA`: gera `Alert` do tipo `TRIP_DELAYED`
  - **Idempotência**: não duplica `Alert` já gerado para o mesmo
    `referenceType + referenceId + type + dueDate` (via `createMany` +
    `skipDuplicates` sobre `@@unique`)
- [x] Envio de e-mail condicionado a `ENABLE_EMAIL_ALERTS=true` (usa SMTP do `.env`);
      em falha de envio o alerta permanece `PENDENTE` e é retentado no próximo ciclo
- [x] `GET /alerts` — lista alertas do usuário/role atual (RBAC: ADMIN vê todos;
      demais veem por `targetRole` ou `targetUserId`); filtro opcional `?status=`
- [x] `PATCH /alerts/:id/read` — marca como lido (404 se o alerta não for visível
      para o usuário)

#### Frontend

- [x] Painel de notificações (badge no header com contagem de não lidos + lista,
      `NotificationsMenu.tsx`, polling a cada 60s, marca como lido ao clicar)

#### Testes (Jest)

- [x] Geração de alertas nos limiares 30/15/7 dias (datas mockadas) — `alerts.util.spec.ts`
- [x] Idempotência: rodar o job duas vezes no mesmo dia não duplica alertas — validado
      via `alerts.service.spec.ts` e também manualmente via cron real (2ª execução:
      "0 novo(s) registrado(s)")
- [x] Alerta de viagem atrasada gerado corretamente

**Critérios de aceite:**

- [x] Todas as verificações da seção 4.10 implementadas
- [x] Job idempotente e testado

**Observação:** durante a validação via Playwright foi corrigido um bug pré-existente
nos componentes `DropdownMenu` (Header e NotificationsMenu) — `DropdownMenuLabel`
precisa estar dentro de `DropdownMenuGroup` (Base UI exige `MenuGroupContext`),
caso contrário o app quebra (tela branca) ao abrir o menu.

---

### Fase 10 — Dashboard e Indicadores (seção 4.11)

**Objetivo:** consolidar indicadores por motorista, veículo e rota.

#### Backend — Módulo `dashboard`

- [x] `GET /dashboard/drivers` — por motorista: KM total rodado, horas dirigidas,
      ocorrências, índice ocorrências/KM, ranking
- [x] `GET /dashboard/vehicles` — por veículo: KM total, tempo de uso, qtd. de usos,
      custos totais, custo/KM, mais utilizado/mais caro
- [x] `GET /dashboard/routes` — por rota: rotas mais utilizadas, distância média, tempo
      médio, custo por rota
- [x] Todas as queries com filtro de período (`from`/`to`), seguindo o padrão de
      agregação em memória (Map) já usado nos demais módulos

#### Frontend

- [x] Páginas de dashboard com gráficos (Recharts): barras/linhas para KM, custos,
      ocorrências; tabelas de ranking
- [x] Filtros de período reutilizáveis

#### Testes (Jest)

- [x] Cada endpoint de agregação retorna valores corretos com dados de seed conhecidos

**Critérios de aceite:**

- [x] Os três dashboards da seção 4.11 implementados e corretos

---

### Fase 11 — Controle Financeiro (seção 4.12)

**Objetivo:** visão consolidada de custos da frota.

#### Backend — Módulo `finance`

- [ ] `GET /finance/monthly` — custo mensal da frota = soma de `Fuel.amountPaid` +
      `Maintenance.cost` + depreciação mensal de todos os veículos ativos (Fase 2)
- [ ] `GET /finance/cost-per-km` — custo médio por KM (custo total / KM total rodado no
      período)
- [ ] `GET /finance/comparison` — comparativo mensal (mês atual vs. anteriores)

#### Frontend

- [ ] Tela financeira: cards de totais + gráfico comparativo mensal

#### Testes (Jest)

- [ ] Cálculo de custo mensal (combustível + manutenção + depreciação)
- [ ] Cálculo de custo médio por KM (incluindo período sem KM rodado → não dividir por
      zero)

**Critérios de aceite:**

- [ ] Indicadores da seção 4.12 corretos com dados de seed

---

### Fase 12 — Metas e Comissão (seção 4.13)

**Objetivo:** metas de redução de consumo e cálculo de comissão/bonificação.

#### Prisma

- [ ] `model Goal`: `id, driverId (nullable), vehicleId (nullable), type (enum:
CONSUMPTION_REDUCTION, ...), period (YYYY-MM), targetValue, actualValue
(nullable), commissionValue (nullable), status (enum: ABERTA, ATINGIDA,
NAO_ATINGIDA), createdBy, createdAt, updatedAt`
- [ ] Migration `add_goals`

#### Backend — Módulo `goals`

- [ ] CRUD de metas (somente `ADMIN`/`COORDENACAO`)
- [ ] Job/serviço que, ao fechar o período, calcula `actualValue` (a partir dos dados de
      `Fuel`/indicadores de consumo da Fase 5) e `commissionValue` conforme regra
      configurável
- [ ] `GET /goals/ranking` — ranking real vs. meta por motorista/veículo

#### Frontend

- [ ] Tela de metas (criação/acompanhamento)
- [ ] Ranking/gamificação integrado ao dashboard (Fase 10)

#### Testes (Jest)

- [ ] Cálculo de `actualValue` vs `targetValue`
- [ ] Cálculo de `commissionValue` (casos: meta atingida, não atingida, superada)

**Critérios de aceite:**

- [ ] Metas e comissões calculadas corretamente conforme seção 4.13

---

### Fase 13 — Relatórios (seção 4.14)

**Objetivo:** exportação de relatórios em PDF, Excel e CSV via fila assíncrona.

#### Backend — Módulo `reports`

- [ ] Fila BullMQ `reports` (Redis) + worker dedicado
- [ ] `POST /reports` — enfileira job com `{ type, format, filters }`, retorna `reportId`
- [ ] `GET /reports/:id` — status do job (`PENDING/PROCESSING/DONE/ERROR`) + link de
      download quando `DONE`
- [ ] Worker gera arquivo em `PDF_STORAGE_PATH` (do `.env`):
  - PDF via **pdf-lib** (tabelas simples — uso diário, custos, manutenções, etc.)
  - Excel via **ExcelJS**
  - CSV via geração nativa (stream)
- [ ] Tipos suportados (seção 4.14): uso diário, histórico por veículo/motorista, custos
      mensais, abastecimentos, manutenções, ocorrências, economia, ranking — cada tipo
      reaproveita as queries dos módulos já implementados (Fases 3-12)

#### Frontend

- [ ] "Central de Relatórios": seleção de tipo + filtros + formato, lista de relatórios
      gerados com status e link de download

#### Testes (Jest)

- [ ] Geração de cada tipo de relatório com dados de seed (valida estrutura básica do
      arquivo gerado: nº de linhas/colunas esperado)
- [ ] Worker processa fila corretamente (job de teste com Redis em memória/test container)

**Critérios de aceite:**

- [ ] Todos os tipos de relatório da seção 4.14 disponíveis nos 3 formatos
- [ ] Geração não bloqueia a API (assíncrona via fila)

---

### Fase 14 — Segurança, Auditoria e Hardening Final (seção 5)

**Objetivo:** revisão transversal de tudo que foi construído contra o checklist de
segurança do `CLAUDE.md`.

- [ ] **Auth**: confirmar expiração curta do access token, refresh em cookie
      `httpOnly; secure; sameSite=strict`
- [ ] **Senhas**: bcrypt custo ≥ 10 em todos os fluxos; nenhuma resposta de API retorna
      `passwordHash`
- [ ] **RBAC**: auditar todos os endpoints — todos declaram `@Roles(...)` explicitamente
      (nenhum endpoint "esquecido" sem guard)
- [ ] **Validação**: todos os DTOs com `class-validator`, `ValidationPipe` global com
      `whitelist`/`forbidNonWhitelisted` ativos
- [ ] **SQL Injection**: confirmar que não há `$queryRawUnsafe`/concatenação manual de SQL
      em nenhum módulo
- [ ] **Rate limiting**: `@nestjs/throttler` em `/auth/login` e demais rotas sensíveis
- [ ] **CORS**: lista explícita de origens via `FRONTEND_URL`/env, sem wildcard `*`
- [ ] **Helmet**: confirmar headers de segurança ativos
- [ ] **Auditoria**: `created_by`/`updated_by`/timestamps presentes em todas as entidades
      sensíveis (vehicles, drivers, daily-logs, trips, fuel, maintenance, incidents,
      shipments, goals)
- [ ] **Logs (Pino)**: revisar `redact` — nunca logar `passwordHash`, tokens, e-mails
      completos ou dados pessoais sensíveis
- [ ] **Dependências**: `npm audit` em backend e frontend, atualizar vulnerabilidades
      críticas/altas
- [ ] **Testes E2E** dos fluxos principais: login (4 perfis), ciclo completo de
      daily-log, viagem, abastecimento, criação de envio com protocolo, geração de alerta

**Critérios de aceite:**

- [ ] 100% dos itens da seção 5 do `CLAUDE.md` verificados e marcados

---

### Fase 15 — Deploy e Produção

**Objetivo:** ambiente produtivo containerizado com HTTPS.

- [ ] `docker-compose.prod.yml` (builds otimizados, sem volumes de dev/hot-reload)
- [ ] Reverse proxy (Nginx ou Caddy) com HTTPS — Caddy recomendado para certificado
      automático via Let's Encrypt em ambiente com domínio próprio
- [ ] `.env.production` baseado em `.env.example`, com secrets reais fora do controle de
      versão
- [ ] `prisma migrate deploy` no pipeline de deploy (nunca `migrate dev` em produção)
- [ ] Estratégia de backup periódico do Postgres (dump agendado)
- [ ] Configuração de `LOG_LEVEL` e rotação de logs (Pino/`pino-roll`) adequada para
      produção

**Critérios de aceite:**

- [ ] Ambiente sobe via `docker compose -f docker-compose.prod.yml up` com HTTPS
      funcionando e migrations aplicadas

---

## Apêndice A — Modelos Prisma por Fase (visão geral)

| Fase  | Models novos                                           | Alterações em models existentes                          |
| ----- | ------------------------------------------------------ | -------------------------------------------------------- |
| 1     | `User`, `Role` (enum)                                  | —                                                        |
| 2     | `Unit`, `Route`, `Vehicle`, `Driver`                   | —                                                        |
| 3     | `DailyLog`                                             | —                                                        |
| 4     | `Trip`                                                 | —                                                        |
| 5     | `Fuel`                                                 | —                                                        |
| 6     | `Maintenance`                                          | `Vehicle` (+ campos `next*`)                             |
| 7     | `Incident`                                             | —                                                        |
| 8     | `Shipment`, `ShipmentStatusHistory`, `ProtocolCounter` | —                                                        |
| 9     | `Alert`                                                | `Vehicle`/`Driver` (+ campos de vencimento, se faltarem) |
| 10-13 | — (somente queries de agregação)                       | —                                                        |
| 12    | `Goal`                                                 | —                                                        |

---

## Apêndice B — Definition of Done padrão (para cada módulo de domínio, Fases 2-13)

- [ ] Model(s) Prisma criado(s)/alterado(s) + migration gerada e aplicada
- [ ] DTOs (`Create`/`Update`/`Query`) com `class-validator` + decorators Swagger
- [ ] Service com regras de negócio implementadas, comentário referenciando a seção do
      `CLAUDE.md` (ex: `// regra da seção 4.6`)
- [ ] Controller com `@Roles(...)` por endpoint, conforme seção 4.1
- [ ] Soft delete onde aplicável (nunca exclusão física de histórico)
- [ ] `created_by`/`updated_by`/timestamps preenchidos automaticamente
- [ ] Testes unitários (Jest) cobrindo as regras críticas e casos de borda
- [ ] Endpoint documentado no Swagger (`/api/docs`)
- [ ] Frontend: página(s) de listagem + formulário (RHF + Zod + shadcn/ui), dados via
      React Query (sem mocks)
- [ ] Mensagens de erro/sucesso em pt-BR
- [ ] Lint/format sem novos warnings

---

## Apêndice C — Riscos e Pontos de Atenção

- **Protocolo de envio sob concorrência (Fase 8)**: o teste de concorrência é obrigatório
  antes de considerar a fase concluída — colisão de protocolo é um bug crítico de
  produção.
- **`Route.estimatedDurationMinutes` (Fase 2)**: precisa estar bem definido desde a Fase 2
  pois a Fase 4 (job de viagens atrasadas) depende diretamente desse valor.
- **Dados de seed**: a partir da Fase 2, manter um script de seed (`prisma/seed.ts`) com
  dados realistas — Fases 10-13 (dashboards, financeiro, metas, relatórios) são
  praticamente impossíveis de validar sem dados consistentes.
- **Visão do perfil `MOTORISTA`**: em todo endpoint consumido por esse perfil (daily-logs,
  trips, fuel, incidents), garantir filtro `driverId = usuário atual` — revisar
  explicitamente na Fase 14.
- **Geração de relatórios pesados (Fase 13)**: sempre via fila BullMQ — nunca síncrono na
  requisição HTTP, mesmo para relatórios "pequenos", para manter consistência.
- **Campos de vencimento (Fase 9)**: decidir se ficam no `Vehicle`/`Driver` (mais simples,
  decisão já tomada neste plano) ou em tabela separada de "agendas" — manter no model
  principal conforme já especificado evita joins extras nos dashboards.
