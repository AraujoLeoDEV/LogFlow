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

- [ ] Criar `/backend` e `/frontend` conforme estrutura da seção 3 do `CLAUDE.md`
- [ ] Inicializar repositório Git (se ainda não houver) + `.gitignore` raiz
      (`node_modules`, `dist`, `.env`, `storage/`, `*.log`)
- [ ] Copiar `.env` atual para `.env.example`, removendo valores sensíveis reais
      (senhas, secrets) e mantendo apenas placeholders

#### 0.2 Backend — bootstrap NestJS

- [ ] `npx @nestjs/cli new backend`
- [ ] Instalar dependências principais:
  - Prisma: `prisma`, `@prisma/client`
  - Auth: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `cookie-parser`
  - Validação: `class-validator`, `class-transformer`
  - Docs: `@nestjs/swagger`
  - Segurança: `helmet`, `@nestjs/throttler`
  - Logs: `nestjs-pino`, `pino-http`, `pino-pretty` (dev), `pino-roll` (rotação)
  - Jobs: `@nestjs/schedule`, `@nestjs/bullmq`, `bullmq`
  - Relatórios: `exceljs`, `pdf-lib`
  - E-mail: `@nestjs-modules/mailer`, `nodemailer`
- [ ] Criar estrutura de pastas conforme seção 3:
      `src/modules/*`, `src/common/{guards,decorators,filters,interceptors,utils}`, `src/prisma`
- [ ] Configurar `main.ts`:
  - `helmet()`
  - CORS com lista explícita de origens via `FRONTEND_URL`
  - `ValidationPipe` global (`whitelist: true, forbidNonWhitelisted: true, transform: true`)
  - Swagger em `/api/docs` (`@nestjs/swagger`)
  - Logger Pino global (substitui logger padrão do Nest)
  - Cookie parser (para refresh token httpOnly)
- [ ] Módulo `health` com `GET /health` (status da API + conexão com banco)

#### 0.3 Prisma

- [ ] `npx prisma init` (datasource `postgresql`, usa `DATABASE_URL` do `.env`)
- [ ] Configurar `PrismaService` (módulo global, `onModuleInit`/`onModuleDestroy`)
- [ ] Definir convenção: tabelas/colunas em `snake_case` via `@@map`/`@map` (seção 6),
      mas atributos do model em `camelCase`
- [ ] Criar enum `Role` e model `User` mínimo (necessário para a Fase 1) e rodar
      `npx prisma migrate dev --name init`

#### 0.4 Frontend — bootstrap Vite

- [ ] `npm create vite@latest frontend -- --template react-ts`
- [ ] Instalar: `tailwindcss postcss autoprefixer`, shadcn/ui (`npx shadcn@latest init`),
      `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`,
      `react-router-dom`, `recharts`, `axios`
- [ ] Criar estrutura `src/{pages,components,hooks,services,lib,types}` (seção 3)
- [ ] Configurar cliente HTTP (`src/lib/api.ts`) com `axios`, `baseURL` via
      `VITE_API_URL`, e interceptor preparado para refresh de token (ativado na Fase 1)
- [ ] Layout base (sidebar + header) com placeholders de navegação por módulo

#### 0.5 Docker & docker-compose

- [ ] `backend/Dockerfile` (multi-stage: build → runtime)
- [ ] `frontend/Dockerfile` (dev: Vite; build: estático servido por Nginx — usado na Fase 15)
- [ ] `docker-compose.yml` na raiz com serviços: `postgres`, `redis`, `backend`, `frontend`
  - Volumes nomeados para dados do Postgres e para `storage/reports`
  - Variáveis lidas do `.env`
- [ ] `docker compose up` sobe tudo sem erros

#### 0.6 Qualidade de código

- [ ] ESLint + Prettier configurados em `backend` e `frontend` (regras alinhadas)
- [ ] Husky + lint-staged (pre-commit: lint + format)
- [ ] (Opcional) commitlint para reforçar Conventional Commits

#### 0.7 Subagente de frontend (opcional)

- [ ] Se for usar subagente dedicado, criar `.claude/agents/frontend.md` com instruções
      de design system (Tailwind + shadcn/ui), para ser referenciado a partir da Fase 1

**Critérios de aceite (DoD Fase 0):**

- [ ] `docker compose up` sobe Postgres, Redis, backend e frontend sem erro
- [ ] `GET /health` retorna 200 e confirma conexão com o banco
- [ ] Swagger acessível em `/api/docs`
- [ ] Frontend acessível em `localhost:5173` exibindo layout base
- [ ] `npx prisma migrate dev` funciona e cria a tabela `users`
- [ ] Lint/format rodando sem erros em ambos os projetos

---

### Fase 1 — Autenticação, Usuários e RBAC (seção 4.1)

**Objetivo:** sistema de login funcional para os 4 perfis (Administrador, Coordenação,
Motorista, Financeiro), com guards reutilizáveis por todo o restante do projeto.

#### Prisma

- [ ] `enum Role { ADMIN COORDENACAO MOTORISTA FINANCEIRO }` (UPPER_SNAKE_CASE, seção 6)
- [ ] `model User`: `id, name, email (unique), passwordHash, role, isActive,
failedLoginAttempts, lockedUntil, createdAt, updatedAt, deletedAt` (soft delete)
- [ ] Migration `add_users_and_roles`

#### Backend

- [ ] `common/utils`: helper de hash/verify com bcrypt (`BCRYPT_ROUNDS` do `.env`, mínimo 10)
- [ ] **Módulo `auth`**
  - `POST /auth/login` — valida credenciais, incrementa `failedLoginAttempts` em caso de
    erro, bloqueia conta (`lockedUntil`) após N tentativas (configurável via env)
  - `POST /auth/refresh` — lê refresh token do cookie `httpOnly`, emite novo access token
  - `POST /auth/logout` — invalida cookie de refresh
  - Access token JWT curto (`JWT_EXPIRES_IN`), refresh token (`JWT_REFRESH_EXPIRES_IN`) em
    cookie `httpOnly; secure; sameSite=strict`
  - `JwtStrategy` (Passport) + `JwtAuthGuard`
  - `@nestjs/throttler` aplicado em `/auth/login` (rate limiting)
- [ ] **Common**
  - `@Roles(...roles: Role[])` decorator + `RolesGuard`
  - `@CurrentUser()` decorator (extrai usuário do request)
  - `GlobalExceptionFilter` retornando mensagens padronizadas em pt-BR
  - Interceptor de auditoria base (preenche `createdBy`/`updatedBy` — usado a partir da Fase 2)
- [ ] **Módulo `users`**
  - CRUD (somente `ADMIN`), nunca retorna `passwordHash`
  - Soft delete (`deletedAt`)
  - Endpoint `GET /users/me` (perfil do usuário autenticado)

#### Frontend

- [ ] Tela de login (shadcn/ui `Form` + RHF + Zod), mensagens de erro em pt-BR
- [ ] `AuthContext`/store: access token em memória, refresh automático via interceptor axios
- [ ] `ProtectedRoute` + verificação de `role` por rota (React Router)
- [ ] Layout: menu lateral exibe apenas itens permitidos para o perfil logado
- [ ] Tela `Usuários` (CRUD, somente visível para `ADMIN`)

#### Testes (Jest)

- [ ] Hash/verify de senha
- [ ] Bloqueio de conta após N tentativas falhas e desbloqueio após expiração
- [ ] `RolesGuard` nega acesso para perfil não permitido
- [ ] Geração/validação de access e refresh tokens

**Critérios de aceite:**

- [ ] Login funciona para os 4 perfis com tokens corretos
- [ ] Rota protegida por `@Roles(Role.ADMIN)` retorna 403 para outros perfis
- [ ] Refresh token renova sessão sem novo login
- [ ] Lockout após N tentativas funciona e é configurável via `.env`

---

### Fase 2 — Cadastros Base: Unidades, Motoristas, Veículos, Rotas (seções 4.2, 4.3)

**Objetivo:** ter todas as "tabelas mestras" que os módulos operacionais (Fases 3-8) vão
referenciar.

#### Prisma

- [ ] `model Unit` (unidades de destino dos envios — usado também na Fase 8): `id, name,
address, active, createdAt, updatedAt`
- [ ] `model Route`: `id, name, origin, destination, estimatedDistanceKm,
estimatedDurationMinutes, active` — `estimatedDurationMinutes` é usado depois pelo
      job de viagens atrasadas (Fase 4)
- [ ] `model Vehicle`: `id, plate (unique), fuelType (enum), tankCapacityLiters,
yearModel, mainRouteId, acquisitionValue, usefulLifeMonths, residualValue,
currentKm, active, deletedAt, createdBy, updatedBy, createdAt, updatedAt` — campos de
      vencimento (`licensingExpiration`, `insuranceExpiration`) entram aqui mas os alertas
      só são implementados na Fase 9
- [ ] `model Driver`: `id, name, position, vehicleId (nullable), currentKm,
defaultRouteId (nullable), cnhExpiration, userId (nullable, FK para User — login do
motorista), active, deletedAt, createdBy, updatedBy, createdAt, updatedAt`
- [ ] Migration `add_units_routes_vehicles_drivers`

#### Backend

- [ ] **Módulo `units`** — CRUD simples (`ADMIN`, `COORDENACAO`)
- [ ] **Módulo `routes`** — CRUD simples (`ADMIN`, `COORDENACAO`)
- [ ] **Módulo `vehicles`**
  - CRUD com soft delete
  - Validador de placa (regex Mercosul `AAA0A00` e antigo `AAA0000`) — DTO custom validator
  - Service `calculateMonthlyDepreciation()`:
    `(acquisitionValue - residualValue) / usefulLifeMonths`
  - Endpoint que retorna depreciação calculada junto do veículo
- [ ] **Módulo `drivers`**
  - CRUD com soft delete, vínculo com `vehicleId`/`defaultRouteId`
  - Endpoint de histórico (placeholder agregando viagens/ocorrências/abastecimentos —
    populado conforme Fases 4, 5, 7 forem concluídas)
  - Se `userId` setado, motorista usa essas credenciais para login (perfil `MOTORISTA`)

#### Frontend

- [ ] Páginas de listagem (DataTable shadcn) + formulário (Dialog/Sheet) para:
      Unidades, Rotas, Veículos, Motoristas
- [ ] Validação de placa também no frontend (Zod regex), espelhando o backend
- [ ] Exibição da depreciação mensal calculada na tela de detalhes do veículo

#### Testes (Jest)

- [ ] Validador de placa: casos válidos/inválidos (Mercosul e antigo)
- [ ] Cálculo de depreciação mensal (casos de borda: vida útil 0/negativa → erro)
- [ ] Soft delete: registro não aparece em listagens padrão mas permanece no banco

**Critérios de aceite:**

- [ ] CRUDs completos e protegidos por `@Roles`
- [ ] Soft delete funcional em `vehicles` e `drivers`
- [ ] Depreciação mensal calculada corretamente e exibida no frontend

---

### Fase 3 — Controle Diário de Uso da Frota (seção 4.4) — núcleo do sistema

**Objetivo:** registrar saída/retorno diário de veículos, com cálculos automáticos e
validações que alimentam todos os indicadores futuros.

#### Prisma

- [ ] `model DailyLog`: `id, vehicleId, driverId, routeId, departureAt, returnAt
(nullable), startKm, endKm (nullable), kmDriven (nullable), totalDurationMinutes
(nullable), avgSpeedKmh (nullable), observations, status (enum: EM_ANDAMENTO,
FINALIZADO), createdBy, updatedBy, createdAt, updatedAt`
- [ ] Migration `add_daily_logs`

#### Backend — Módulo `daily-logs`

- [ ] `POST /daily-logs` (iniciar saída): valida que não existe registro `EM_ANDAMENTO`
      para o mesmo `vehicleId` → senão `409 Conflict`
- [ ] `PATCH /daily-logs/:id/return` (registrar retorno):
  - Valida `endKm >= startKm`, senão `422 Unprocessable Entity` (regra explícita da seção 4.4)
  - Calcula automaticamente: `kmDriven = endKm - startKm`,
    `totalDurationMinutes = returnAt - departureAt`,
    `avgSpeedKmh = kmDriven / (totalDurationMinutes / 60)`
  - Atualiza `vehicle.currentKm = endKm`
  - Marca `status = FINALIZADO`
- [ ] `GET /daily-logs` — histórico com filtros por veículo, motorista, rota, período
- [ ] Guard: perfil `MOTORISTA` só vê/edita registros do próprio `driverId`

#### Frontend

- [ ] Tela "Saída/Retorno" — fluxo operacional rápido (registrar saída; depois registrar
      retorno do registro em andamento)
- [ ] Tela de histórico com filtros (data, veículo, motorista, rota) e colunas calculadas
      (KM rodado, duração, velocidade média)

#### Testes (Jest)

- [ ] Rejeita `endKm < startKm` com 422
- [ ] Bloqueia novo registro `EM_ANDAMENTO` se já existir um para o mesmo veículo
- [ ] Cálculo de `kmDriven`, `totalDurationMinutes`, `avgSpeedKmh` com casos normais e de
      borda (duração zero, etc.)
- [ ] `vehicle.currentKm` é atualizado corretamente ao finalizar

**Critérios de aceite:**

- [ ] Todas as regras da seção 4.4 implementadas e testadas
- [ ] Frontend reflete em tempo real o status "em andamento"/"finalizado"

---

### Fase 4 — Sistema de Viagens (Trips) (seção 4.5)

**Objetivo:** controlar viagens com status e detecção automática de atrasos.

#### Prisma

- [ ] `model Trip`: `id, vehicleId, driverId, routeId, status (enum: EM_ANDAMENTO,
FINALIZADA, ATRASADA), destination, startKm, endKm (nullable), startedAt,
finishedAt (nullable), createdBy, updatedBy, createdAt, updatedAt`
- [ ] Migration `add_trips`

#### Backend — Módulo `trips`

- [ ] `POST /trips` — cria viagem associando veículo + motorista + rota, `status =
EM_ANDAMENTO`, `startKm` informado
- [ ] `PATCH /trips/:id/finish` — valida `endKm >= startKm`, define `finishedAt`,
      `status = FINALIZADA`
- [ ] `GET /trips` — histórico completo por motorista/veículo, com filtro de status
- [ ] **Job agendado** (`@Cron`, a cada X minutos): busca `Trip` com `status =
EM_ANDAMENTO` cujo `startedAt + route.estimatedDurationMinutes < now()` e atualiza
      para `status = ATRASADA`
- [ ] Guard: perfil `MOTORISTA` só vê/opera as próprias viagens

#### Frontend

- [ ] Tela de viagens (lista ou kanban por status: Em andamento / Finalizada / Atrasada)
- [ ] Ação "Iniciar viagem" / "Encerrar viagem" (com input de KM devolução)
- [ ] Indicador visual (badge vermelho) para viagens `ATRASADA`

#### Testes (Jest)

- [ ] Encerramento rejeita `endKm < startKm`
- [ ] Job de atraso: viagem além do tempo estimado da rota é marcada `ATRASADA`
      (usar fake timers / datas mockadas)
- [ ] Viagem finalizada a tempo nunca é marcada como atrasada

**Critérios de aceite:**

- [ ] Transições de status corretas (`EM_ANDAMENTO → FINALIZADA` /
      `EM_ANDAMENTO → ATRASADA`)
- [ ] Job roda automaticamente e é idempotente (não reprocessa viagens já finalizadas)

---

### Fase 5 — Controle de Abastecimento (seção 4.6)

**Objetivo:** registrar abastecimentos com cálculo automático de consumo e custo.

#### Prisma

- [ ] `model Fuel`: `id, vehicleId, driverId, liters, amountPaid, currentKm, fuelType
(enum), date, consumptionKmL (nullable), costPerKm (nullable), createdBy,
updatedBy, createdAt, updatedAt`
- [ ] Migration `add_fuel`

#### Backend — Módulo `fuel`

- [ ] `POST /fuel`:
  - Rejeita se `currentKm` < último `currentKm` registrado para o veículo (404/422)
  - Valida que `fuelType` é compatível com `vehicle.fuelType`
  - Calcula:
    - `consumptionKmL = (currentKm - kmDoAbastecimentoAnterior) / liters`
    - `costPerKm = amountPaid / (currentKm - kmDoAbastecimentoAnterior)`
  - Atualiza `vehicle.currentKm` se este abastecimento for o mais recente
- [ ] `GET /fuel/indicators`:
  - Média KM/L por veículo
  - Veículo mais econômico / mais caro
  - Gasto mensal (total e por veículo)

#### Frontend

- [ ] Tela de registro de abastecimento (formulário)
- [ ] Cards de indicadores + gráfico (Recharts) de consumo por veículo / gasto mensal

#### Testes (Jest)

- [ ] Rejeita `currentKm` menor que o último registrado
- [ ] Valida incompatibilidade de tipo de combustível
- [ ] Cálculo de `consumptionKmL` e `costPerKm` (incluindo primeiro abastecimento sem
      anterior — não deve calcular, deve retornar `null`)

**Critérios de aceite:**

- [ ] Todas as regras da seção 4.6 implementadas e testadas
- [ ] Indicadores corretos com dados de seed

---

### Fase 6 — Controle de Manutenção (seção 4.7)

**Objetivo:** histórico e agenda de manutenções, preparando os campos que a Fase 9
(Alertas) vai consumir.

#### Prisma

- [ ] `model Maintenance`: `id, vehicleId, type (enum: PREVENTIVA, CORRETIVA), km, cost,
description, scheduledDate (nullable), scheduledKm (nullable), performedDate
(nullable), createdBy, updatedBy, createdAt, updatedAt`
- [ ] Campos adicionais em `Vehicle` (alterar via migration): `nextOilChangeKm,
nextOilChangeDate, nextTireChangeKm, nextTireChangeDate, nextReviewKm,
nextReviewDate` (todos nullable) — usados pelos alertas (Fase 9)
- [ ] Migration `add_maintenance_and_vehicle_schedule_fields`

#### Backend — Módulo `maintenance`

- [ ] CRUD de manutenções (histórico por veículo)
- [ ] Ao registrar manutenção concluída, atualizar os campos `next*` do `Vehicle`
      correspondentes ao tipo realizado (ex: troca de óleo → recalcula `nextOilChangeKm`/`Date`
      com base em `KM_ALERT_OIL_CHANGE`/`KM_ALERT_MAINTENANCE` do `.env`)
- [ ] `GET /maintenance/schedule` — agenda (próximas manutenções por data/KM, ordenadas
      por proximidade)

#### Frontend

- [ ] Tela de histórico de manutenção por veículo
- [ ] Tela de agenda (lista de próximas manutenções, ordenada por urgência)

#### Testes (Jest)

- [ ] Atualização dos campos `next*` do veículo após registrar manutenção
- [ ] Cálculo da agenda (ordenação por proximidade de data/KM)

**Critérios de aceite:**

- [ ] Histórico funcional por veículo
- [ ] Campos `next*` do `Vehicle` corretamente atualizados — base para a Fase 9

---

### Fase 7 — Controle de Ocorrências (seção 4.8)

**Objetivo:** registrar ocorrências e calcular indicadores de segurança/operação.

#### Prisma

- [ ] `model Incident`: `id, vehicleId, driverId, category, type, severity (enum:
BAIXA, MEDIA, ALTA, CRITICA), responsible, cost (nullable), observations, date,
createdBy, updatedBy, createdAt, updatedAt`
- [ ] Migration `add_incidents`

#### Backend — Módulo `incidents`

- [ ] CRUD de ocorrências
- [ ] `GET /incidents/indicators`:
  - Ocorrências por motorista
  - Ocorrências por veículo
  - Índice ocorrências/KM rodado (usa soma de `DailyLog.kmDriven` ou `Trip` no período)

#### Frontend

- [ ] Tela de registro/listagem de ocorrências (filtro por veículo, motorista, categoria,
      gravidade, período)
- [ ] Cards/gráficos de indicadores

#### Testes (Jest)

- [ ] Cálculo do índice ocorrências/KM (incluindo divisão por zero quando não há KM
      rodado no período)

**Critérios de aceite:**

- [ ] CRUD completo e indicadores corretos com dados de seed

---

### Fase 8 — Módulo de Envios / Protocolo (seção 4.9)

**Objetivo:** envio de itens entre unidades com protocolo único gerado de forma atômica.

#### Prisma

- [ ] `model Shipment`: `id, protocolNumber (unique), destinationUnitId, items (Json),
senderId, transporterId (nullable), observations, status (enum: PENDENTE,
EM_TRANSITO, ENTREGUE, CANCELADO), createdBy, createdAt, updatedAt`
- [ ] `model ShipmentStatusHistory`: `id, shipmentId, status, changedAt, changedBy,
notes (nullable)` — timeline de movimentações
- [ ] Sequence/contador atômico para gerar `protocolNumber` no formato `AAAAMMDD-SEQ`
      (ex: tabela `protocol_counters(date, last_seq)` atualizada via transação com
      `SELECT ... FOR UPDATE`, ou `Prisma.$transaction` com `UPDATE ... RETURNING`)
- [ ] Migration `add_shipments`

#### Backend — Módulo `shipments`

- [ ] `POST /shipments`:
  - Gera `protocolNumber` de forma atômica (sem colisão sob concorrência)
  - `status` inicial = `PENDENTE`, cria primeira entrada em `ShipmentStatusHistory`
- [ ] `PATCH /shipments/:id/status` — atualiza status (`PENDENTE → EM_TRANSITO →
ENTREGUE` ou `CANCELADO`), grava nova entrada na timeline
- [ ] `GET /shipments/:protocolNumber` — detalhes + timeline completa
- [ ] `GET /shipments` — listagem com filtro por status/unidade/período

#### Frontend

- [ ] Tela de criação de envio (seleção de unidade destino, itens, responsáveis,
      observações)
- [ ] Listagem com filtro por status
- [ ] Tela de detalhes com timeline visual de status

#### Testes (Jest)

- [ ] Geração de protocolo: formato correto (`AAAAMMDD-SEQ`)
- [ ] **Teste de concorrência**: N criações simultâneas geram N protocolos únicos sem
      colisão
- [ ] Transições de status válidas/inválidas e registro correto na timeline

**Critérios de aceite:**

- [ ] Protocolos únicos garantidos mesmo sob concorrência (testado)
- [ ] Timeline completa e correta por protocolo

---

### Fase 9 — Alertas Automáticos (Job Agendado Diário) (seção 4.10)

**Objetivo:** job diário que verifica vencimentos e gera notificações in-app (+ e-mail
opcional).

#### Prisma

- [ ] `model Alert`: `id, type (enum: LICENSING, INSURANCE, CNH, REVIEW, OIL_CHANGE,
TIRE_CHANGE, TRIP_DELAYED), referenceType, referenceId, message, severity (enum:
INFO, AVISO, CRITICO), dueDate (nullable), status (enum: PENDENTE, ENVIADO, LIDO),
targetRole (nullable), targetUserId (nullable), createdAt`
- [ ] Campos de vencimento em `Vehicle` (`licensingExpiration`, `insuranceExpiration`) e
      em `Driver` (`cnhExpiration`) — se ainda não existirem, adicionar nesta fase
- [ ] Migration `add_alerts_and_expiration_fields`

#### Backend — Módulo `alerts`

- [ ] `@Cron` diário (ex: 06:00, configurável):
  - Para cada `Vehicle`: verifica `licensingExpiration`, `insuranceExpiration`,
    `nextOilChangeKm/Date`, `nextTireChangeKm/Date`, `nextReviewKm/Date` — gera `Alert`
    nos limiares **30/15/7 dias** antes (ou KM equivalente)
  - Para cada `Driver`: verifica `cnhExpiration` (mesmos limiares)
  - Para `Trip` com `status = ATRASADA`: gera `Alert` do tipo `TRIP_DELAYED`
  - **Idempotência**: não duplicar `Alert` já gerado para o mesmo
    `referenceType + referenceId + type + dueDate`
- [ ] Envio de e-mail condicionado a `ENABLE_EMAIL_ALERTS=true` (usa SMTP do `.env`)
- [ ] `GET /alerts` — lista alertas do usuário/role atual
- [ ] `PATCH /alerts/:id/read` — marca como lido

#### Frontend

- [ ] Painel de notificações (badge no header com contagem de não lidos + lista)

#### Testes (Jest)

- [ ] Geração de alertas nos limiares 30/15/7 dias (datas mockadas)
- [ ] Idempotência: rodar o job duas vezes no mesmo dia não duplica alertas
- [ ] Alerta de viagem atrasada gerado corretamente

**Critérios de aceite:**

- [ ] Todas as verificações da seção 4.10 implementadas
- [ ] Job idempotente e testado

---

### Fase 10 — Dashboard e Indicadores (seção 4.11)

**Objetivo:** consolidar indicadores por motorista, veículo e rota.

#### Backend — Módulo `dashboard`

- [ ] `GET /dashboard/drivers` — por motorista: KM total rodado, horas dirigidas,
      ocorrências, índice ocorrências/KM, ranking
- [ ] `GET /dashboard/vehicles` — por veículo: KM total, tempo de uso, qtd. de usos,
      custos totais, custo/KM, mais utilizado/mais caro
- [ ] `GET /dashboard/routes` — por rota: rotas mais utilizadas, distância média, tempo
      médio, custo por rota
- [ ] Todas as queries via Prisma `groupBy`/`aggregate`, com filtro de período (mês/ano)

#### Frontend

- [ ] Páginas de dashboard com gráficos (Recharts): barras/linhas para KM, custos,
      ocorrências; tabelas de ranking
- [ ] Filtros de período reutilizáveis

#### Testes (Jest)

- [ ] Cada endpoint de agregação retorna valores corretos com dados de seed conhecidos

**Critérios de aceite:**

- [ ] Os três dashboards da seção 4.11 implementados e corretos

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
