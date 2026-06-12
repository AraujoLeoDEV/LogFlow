# CLAUDE.md — Sistema de Logística e Controle de Frota

Este arquivo contém o contexto e as diretrizes que o Claude Code deve seguir
ao trabalhar neste projeto. Leia-o antes de iniciar qualquer tarefa.

---

## 1. Visão Geral do Projeto

Aplicação web para gestão logística e de frota, com:

- Controle de envios de itens entre unidades (com protocolo único)
- Cadastro e controle de veículos, motoristas e rotas
- Registro diário de uso da frota (saída/retorno, KM, tempo)
- Sistema de viagens (trips)
- Controle de abastecimento e manutenção
- Controle de ocorrências
- Dashboards e indicadores (motorista, veículo, rota)
- Controle financeiro da frota
- Sistema de metas e comissão
- Relatórios exportáveis (PDF, Excel, CSV)
- Controle de usuários com login/senha e níveis de acesso (RBAC)
- Alertas automáticos de vencimento (licenciamento, seguro, CNH, revisão, óleo etc.)

A aplicação roda em uma máquina dedicada com banco de dados relacional.

---

## 2. Stack Tecnológica

### Backend

- **Linguagem:** TypeScript
- **Framework:** NestJS (estrutura modular por domínio)
- **ORM:** Prisma
- **Banco de dados:** PostgreSQL
- **Autenticação:** JWT (access + refresh token) + bcrypt para hash de senhas
- **Autorização:** RBAC via Guards/Decorators do NestJS
- **Validação:** Zod (ou class-validator, manter consistência em todo o projeto)
- **Jobs agendados:** node-cron ou BullMQ (para verificação diária de alertas)
- **Geração de relatórios:** ExcelJS (Excel), pdf-lib ou Puppeteer (PDF)
- **Logs:** Winston ou Pino, com rotação de arquivos

### Frontend

- **Framework:** React + TypeScript + Vite
- **Estilização:** TailwindCSS + shadcn/ui
- **Gerenciamento de estado/dados remotos:** React Query (TanStack Query)
- **Formulários:** React Hook Form + Zod
- **Roteamento:** React Router
- **Gráficos/dashboards:** Recharts

### Infraestrutura

- Docker + docker-compose (app + banco de dados + redis, se necessário)
- Variáveis sensíveis sempre via `.env` (nunca commitadas — usar `.env.example`)
- HTTPS obrigatório em produção (configurar via proxy reverso, ex: Nginx/Caddy)

> Se o subagente de frontend estiver configurado em `.claude/agents/`,
> delegue a ele tarefas de criação/ajuste de componentes de UI, layouts,
> formulários e telas do dashboard, mantendo consistência com o design
> system (Tailwind + shadcn/ui).

---

## 3. Estrutura de Diretórios (sugerida)

```
/backend
  /src
    /modules
      /auth
      /users
      /drivers          # motoristas
      /vehicles         # veículos
      /routes           # rotas
      /daily-logs       # registro diário de uso
      /trips            # viagens
      /fuel             # abastecimento
      /maintenance      # manutenção
      /incidents        # ocorrências
      /shipments        # envios/protocolos
      /units            # unidades cadastradas
      /finance          # controle financeiro
      /goals            # metas e comissão
      /reports          # relatórios
      /dashboard        # indicadores
      /alerts           # alertas automáticos (cron)
    /common
      /guards
      /decorators
      /filters
      /interceptors
      /utils
    /prisma
      schema.prisma
      /migrations
  .env.example

/frontend
  /src
    /pages
    /components
    /hooks
    /services           # chamadas à API
    /lib
    /types
```

---

## 4. Módulos Funcionais e Regras de Negócio

### 4.1 Usuários e Permissões (RBAC)

Perfis de acesso:

| Perfil            | Permissões                                                       |
| ----------------- | ---------------------------------------------------------------- |
| **Administrador** | Acesso total ao sistema                                          |
| **Coordenação**   | Gerencia frota, relatórios, indicadores, manutenção, ocorrências |
| **Motorista**     | Acesso restrito: viagens próprias, abastecimentos, ocorrências   |
| **Financeiro**    | Custos, relatórios financeiros, indicadores financeiros          |

Regras:

- Senhas sempre armazenadas com hash (bcrypt, custo mínimo 10).
- Bloqueio de conta após N tentativas de login falhas (configurável).
- Sessões via JWT com expiração curta + refresh token.
- Toda rota da API deve declarar explicitamente os perfis permitidos
  (nunca depender de "esquecimento" como segurança).

### 4.2 Cadastro de Motoristas

Campos: nome, cargo/função, veículo vinculado, KM atual, rota padrão.

Funcionalidades:

- CRUD completo de condutores
- Associação de veículos e rotas
- Controle de KM inicial/primário
- Histórico de utilização (viagens, ocorrências, abastecimentos)
- Soft delete (não excluir fisicamente — manter histórico íntegro)

### 4.3 Cadastro de Veículos

Campos: ID, placa (única), tipo de combustível, capacidade do tanque,
ano/modelo, rota principal, valor de aquisição, vida útil, depreciação mensal,
valor residual estimado.

Funcionalidades:

- CRUD completo
- Cálculo automático de depreciação mensal
  (ex: linear: `(valor_aquisicao - valor_residual) / vida_util_meses`)
- Validação de formato de placa (padrão Mercosul e antigo)

### 4.4 Controle Diário de Uso da Frota (núcleo do sistema)

Campos: veículo, motorista, rota, hora saída, hora retorno, KM inicial,
KM final, observações.

Regras de negócio (validar no backend, nunca confiar só no frontend):

- `KM final >= KM inicial` (rejeitar e retornar erro 422 caso contrário)
- Ao salvar, atualizar automaticamente o KM atual do veículo
- Calcular automaticamente:
  - KM rodado = KM final - KM inicial
  - Tempo total de rota = hora retorno - hora saída
  - Média operacional (KM/hora)
- Não permitir novo registro de saída se já existe um "em andamento"
  para o mesmo veículo

### 4.5 Sistema de Viagens (Trips)

Status possíveis: `EM_ANDAMENTO`, `FINALIZADA`, `ATRASADA`.

Funcionalidades:

- Criar viagem associando veículo + motorista
- Registrar KM retirada / KM devolução, destino/rota, combustível
- Encerrar viagem (valida KM devolução >= KM retirada)
- Job agendado marca como `ATRASADA` viagens que excederem tempo
  estimado da rota sem finalização
- Histórico completo por motorista/veículo

### 4.6 Controle de Abastecimento

Campos: veículo, litros, valor pago, KM atual, motorista responsável.

Regras:

- Rejeitar abastecimento com KM menor que o último registrado para o veículo
- Validar que o tipo de combustível é compatível com o veículo
- Calcular automaticamente:
  - Consumo (KM/L) = (KM atual - KM do abastecimento anterior) / litros
  - Custo por KM = valor pago / KM rodado desde último abastecimento

Indicadores: média KM/L, veículo mais econômico/mais caro, gasto mensal.

### 4.7 Controle de Manutenção

Campos: veículo, tipo (preventiva/corretiva), KM, custo, observações técnicas.

Funcionalidades:

- Histórico por veículo
- Agenda de manutenção (datas/KM previstos)
- **Alertas automáticos** (ver seção 4.10) para:
  - Troca de óleo
  - Troca de pneus
  - Revisão geral

### 4.8 Controle de Ocorrências

Campos: veículo, motorista, categoria, tipo, gravidade, responsável, custo,
observações.

Exemplos de tipo: multa, acidente, pane, atraso, dano ao veículo.

Indicadores: ocorrências por motorista, por veículo, índice por KM rodado.

### 4.9 Módulo de Envios (Protocolo)

Funcionalidades:

- Envio de itens para unidades pré-cadastradas
- Geração automática de **número de protocolo único**
  (ex: formato `AAAAMMDD-SEQ` ou UUID curto, gerado de forma atômica
  no backend para evitar colisão em concorrência — usar sequence do
  Postgres ou transação com lock)
- Campos: unidade de destino, itens, responsável pelo envio,
  responsável pelo transporte, campo de observação
- Status do envio: `PENDENTE`, `EM_TRANSITO`, `ENTREGUE`, `CANCELADO`
- Histórico completo de movimentações por protocolo (timeline de status)

### 4.10 Alertas Automáticos (Job Agendado Diário)

Verificar diariamente e notificar (in-app + e-mail, se configurado):

- Licenciamento do veículo vencendo (ex: aviso 30/15/7 dias antes)
- Seguro vencendo
- CNH do motorista vencendo
- Revisão próxima (por data ou por KM)
- Troca de óleo (por data ou por KM)
- Troca de pneus
- Viagens em atraso (status `ATRASADA`)

Implementar como módulo `alerts` com cron job (`@Cron` do NestJS) que
consulta todas as datas/KMs relevantes e gera registros de notificação.

### 4.11 Dashboard e Indicadores

- **Por motorista:** KM total rodado, horas dirigidas, ocorrências, índice
  ocorrências/KM, ranking
- **Por veículo:** KM total, tempo de uso, quantidade de usos, custos totais,
  custo por KM, mais utilizado/mais caro
- **Por rota:** rotas mais utilizadas, distância média, tempo médio, custo
  por rota

### 4.12 Controle Financeiro

- Custo mensal da frota (combustível + manutenção + depreciação)
- Custo médio por KM
- Comparativo mensal
- Metas de redução e economia obtida

### 4.13 Metas e Comissão

- Meta de redução de consumo por motorista/veículo
- Comparativo mensal real vs. meta
- Cálculo automático de comissão/bonificação (motoristas e coordenação)
- Considerar exibir como ranking/gamificação no dashboard

### 4.14 Relatórios

Gerar e exportar (PDF, Excel, CSV):

- Uso diário
- Histórico por veículo / por motorista
- Custos mensais
- Abastecimentos
- Manutenções
- Ocorrências
- Economia
- Ranking

---

## 5. Segurança (obrigatório)

- **Autenticação:** JWT com expiração curta (ex: 15min) + refresh token
  (ex: 7 dias), refresh token armazenado em cookie `httpOnly`, `secure`,
  `sameSite=strict`
- **Senhas:** hash com bcrypt (custo >= 10), nunca logar/retornar senha em
  nenhuma resposta de API
- **RBAC:** todo endpoint protegido por Guards explícitos por perfil
- **Validação de entrada:** validar e sanitizar TODOS os inputs (Zod/DTOs)
  no backend, mesmo que já validados no frontend
- **SQL Injection:** usar exclusivamente Prisma (queries parametrizadas),
  nunca concatenar SQL manualmente
- **Rate limiting:** aplicar em rotas de login/autenticação (ex: `@nestjs/throttler`)
- **CORS:** configurar lista explícita de origens permitidas
- **Headers de segurança:** usar `helmet` no NestJS
- **Auditoria:** registrar quem criou/alterou registros sensíveis
  (created_by, updated_by, timestamps)
- **Variáveis de ambiente:** nunca commitar `.env`; manter `.env.example`
  atualizado
- **Logs:** nunca logar dados sensíveis (senhas, tokens, dados pessoais
  completos)
- **Dependências:** rodar `npm audit` periodicamente, manter libs atualizadas

---

## 6. Convenções de Código

- **Linguagem das variáveis/código:** inglês
- **Linguagem da UI/mensagens ao usuário:** português (pt-BR)
- **Nomenclatura:**
  - Tabelas/colunas do banco: `snake_case`
  - Variáveis/funções TS: `camelCase`
  - Classes/Componentes/DTOs: `PascalCase`
  - Enums: `UPPER_SNAKE_CASE`
- **Commits:** seguir Conventional Commits (`feat:`, `fix:`, `refactor:`,
  `chore:`, `docs:`, `test:`)
- **Testes:** escrever testes unitários para regras de negócio críticas
  (cálculo de KM, depreciação, geração de protocolo, validações de
  abastecimento) usando Jest
- **Migrations:** sempre gerar migration via Prisma (`prisma migrate dev`),
  nunca alterar schema diretamente no banco
- **Tratamento de erros:** usar exceptions padronizadas do NestJS
  (`BadRequestException`, `ForbiddenException`, etc.) com mensagens claras
  em português para o usuário final

---

## 7. Como o Claude deve trabalhar neste projeto

1. Antes de criar um módulo novo, verificar se já existe estrutura similar
   e seguir o mesmo padrão.
2. Sempre implementar validação no backend, independentemente do frontend.
3. Ao criar/alterar entidades do Prisma, gerar a migration correspondente.
4. Para tarefas de UI/UX (componentes React, telas, dashboards), delegar ao
   subagente de frontend (se configurado em `.claude/agents/`), garantindo
   uso consistente de Tailwind + shadcn/ui.
5. Priorizar segurança: nunca remover validações, guards ou sanitização para
   "fazer funcionar mais rápido".
6. Documentar endpoints novos (Swagger/OpenAPI via `@nestjs/swagger`).
7. Ao implementar regras de negócio desta documentação, referenciar a seção
   correspondente (ex: "implementando regra da seção 4.4") nos comentários
   de código relevantes.
