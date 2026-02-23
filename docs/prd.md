# Product Requirements Document: ResFin Content Studio

> **Gerado por:** @pm (Morgan) — AIOS v2.0
> **Data:** 2026-02-22
> **Versão:** 1.0
> **Status:** Draft
> **Referência:** `docs/brief.md`

---

## Goals and Background Context

### Objetivo
Criar uma aplicação web visual que permite Max Linder operar de forma independente e escalável o sistema de criação de conteúdo para @residenciaemfinancas — sem terminal, sem prompts manuais, com interface visual no navegador.

### Contexto
O sistema de conteúdo já foi projetado (brief.yaml, tone_guide.md, persona Leandro Ladeira). O que falta é a interface que conecta todas as peças. O app substitui o fluxo atual de "copiar e colar prompts no Claude" por uma experiência guiada e persistente.

### Stack aprovada
- **Frontend/Backend:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Deploy:** Vercel (hobby plan)
- **Storage:** Supabase
- **AI Copy:** Anthropic Claude API (`claude-sonnet-4-6`)
- **AI Research:** Gemini API com Google Search grounding
- **AI Image:** Google Imagen (NanoBanana) — DALL-E 3 como fallback

---

## Functional Requirements

### FR-01 — Módulo de Pesquisa (Research)

**FR-01.1** O app deve permitir que o usuário clique em um botão "Buscar Trends da Semana" que dispara uma chamada à Gemini API com Google Search grounding, retornando 10 trending topics relevantes para finanças e médicos brasileiros.

**FR-01.2** Cada trend retornada deve exibir: título do tema, plataforma onde está em alta, pilar de conteúdo sugerido (dos 7 pilares do brief.yaml) e um exemplo de hook.

**FR-01.3** O usuário deve conseguir selecionar 1 ou mais trends para trabalhar.

**FR-01.4** O usuário deve conseguir ignorar todos os trends e digitar manualmente um tema próprio em um campo de texto livre.

**FR-01.5** O usuário deve conseguir colar um rascunho de copy já escrito para o agente refinar (em vez de gerar do zero).

---

### FR-02 — Módulo de Geração de Copy (Copy Studio)

**FR-02.1** Com um tema selecionado (via pesquisa ou input manual), o usuário deve escolher: formato do post (carrossel / post estático / reels / stories) e voz (Max Linder / Rian Tavares / Marca Institucional).

**FR-02.2** O app deve chamar a Claude API usando a persona Leandro Ladeira + contexto completo do brief.yaml do @residenciaemfinancas embutido no system prompt.

**FR-02.3** O app deve retornar 3 ideias de copy distintas (ângulo educativo, provocativo e storytelling) no mesmo formato definido no `prompts.md`.

**FR-02.4** Cada ideia deve exibir: hook, copy completa, sugestão visual e CTA com keyword ManyChat.

**FR-02.5** O usuário deve conseguir selecionar uma das 3 ideias para seguir para revisão.

**FR-02.6** Se o usuário colou um rascunho (FR-01.5), o agente deve refinar o rascunho aplicando o método Light Copy (premissas irrefutáveis, sem imperativo, CTA com keyword) em vez de gerar do zero.

---

### FR-03 — Módulo de Revisão e Edição (Review)

**FR-03.1** A copy selecionada deve ser exibida em um mockup visual que simula como ficaria no feed do Instagram (proporção quadrada ou 4:5).

**FR-03.2** O usuário deve conseguir editar o texto da copy diretamente no mockup (edição inline).

**FR-03.3** O usuário deve ter 3 ações disponíveis: **Aprovar** (vai para geração de imagem), **Rejeitar** (volta para Copy Studio), **Nova versão** (Claude gera mais 3 opções com o mesmo tema).

**FR-03.4** O app deve exibir um checklist automático baseado nas restrições do tone_guide.md (ex: "CTA tem keyword ManyChat? ✅", "Produto Patrimonial não nomeado? ✅").

---

### FR-04 — Módulo de Geração de Imagem (Image Studio)

**FR-04.1** Com a copy aprovada, o app deve gerar automaticamente um prompt de imagem baseado na sugestão visual da copy.

**FR-04.2** O app deve chamar a Google Imagen API (NanoBanana) e retornar 2-4 variações de imagem.

**FR-04.3** O usuário deve conseguir visualizar as imagens lado a lado e selecionar a imagem final.

**FR-04.4** O usuário deve conseguir solicitar nova geração de imagens com instruções adicionais (ex: "mais clean", "fundo azul").

**FR-04.5** O app deve usar DALL-E 3 como fallback caso a Google Imagen API não esteja disponível.

---

### FR-05 — Pipeline de Conteúdo

**FR-05.1** Todos os posts gerados devem ser salvos automaticamente no Supabase com os campos: id, data_criacao, tema, pilar, voz, formato, copy, visual_descricao, cta, keyword_manychat, status (pending / approved / published), imagem_url.

**FR-05.2** O app deve ter uma view de Pipeline com 3 colunas Kanban: **Pending**, **Approved**, **Published**.

**FR-05.3** O usuário deve conseguir mover cards entre colunas via drag-and-drop ou botões.

**FR-05.4** O usuário deve conseguir abrir qualquer card para ver o post completo (copy + imagem) e editar observações.

**FR-05.5** O app deve exibir um log de atividade com data e hora de cada ação (criado, aprovado, publicado).

---

## Non-Functional Requirements

**NFR-01 — Performance**
- Geração de copy deve completar em < 15 segundos
- Geração de imagem deve completar em < 40 segundos
- Interface deve exibir loading state visual durante todas as operações de API

**NFR-02 — Segurança**
- Nenhuma API key deve ser exposta no lado cliente (browser)
- Todas as chamadas de API devem ser feitas via Next.js API Routes (server-side)
- Variáveis de ambiente gerenciadas pelo Vercel Environment Variables

**NFR-03 — Usabilidade**
- Interface operável por usuário não-técnico sem treinamento além do onboarding inicial
- Nenhum terminal ou linha de comando necessária após setup inicial
- Mensagens de erro em português, descritivas e com sugestão de ação

**NFR-04 — Disponibilidade**
- Deploy no Vercel com uptime do plano hobby (>99%)
- Sem necessidade de servidor dedicado ou manutenção manual

**NFR-05 — Custo**
- Supabase: plano inicial com limites suficientes para MVP
- APIs pagas monitoradas por request (sem surpresas de billing)

---

## UI/UX Design Goals

- **Visual first:** Interface que mostra o post como seria no Instagram antes de aprovar
- **Linear e guiado:** Fluxo em 5 passos claros (Research → Copy → Review → Image → Pipeline)
- **Sem ambiguidade:** Cada tela tem 1 ação principal em destaque
- **Feedback imediato:** Todo clique responde visualmente (loading, sucesso, erro)
- **Paleta:** Alinhada com identidade visual do @residenciaemfinancas (cores sóbrias, tipografia clean)

---

## Requirements Sharding — Épicos

| Épico | Módulo | Stories estimadas | Prioridade |
|---|---|---|---|
| EPIC-01 | Setup + Infra (Next.js, Vercel, Supabase, env vars) | 2 | P0 |
| EPIC-02 | Research Module (trends + referências + input manual) | 3 | P1 |
| EPIC-03 | Copy Studio (Claude API + Leandro Ladeira) | 2 | P1 |
| EPIC-04 | Review + Pipeline (mockup, KV, kanban) | 4 | P1 |
| EPIC-05 | Image Studio (Google Imagen + fallback DALL-E) | 2 | P2 |

**Total estimado:** 14 stories

---

## Next Steps

1. @pm cria os 5 épicos (`docs/epics/`)
2. @sm cria as stories de EPIC-01 primeiro (setup e infra)
3. @po valida as stories
4. @dev implementa EPIC-01 antes de qualquer outro épico
5. Sequência: EPIC-01 → EPIC-02 → EPIC-03 → EPIC-04 → EPIC-05

---

*PRD gerado por @pm (Morgan) — AIOS v2.0. Aprovação de Max Linder necessária antes da criação dos épicos.*
