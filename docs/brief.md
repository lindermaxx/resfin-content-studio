# Project Brief: ResFin Content Studio

> **Gerado por:** @pm (Morgan) — AIOS v2.0
> **Data:** 2026-02-22
> **Status:** Draft → aguardando revisão de Max Linder

---

## Executive Summary

ResFin Content Studio é uma aplicação web visual que automatiza o fluxo de criação de conteúdo para o Instagram @residenciaemfinancas. O usuário (Max Linder, não-técnico) opera todo o processo — pesquisa de trending topics, geração de copy via IA com persona Leandro Ladeira, revisão, geração de imagens e gestão do pipeline de publicação — em uma interface visual acessível pelo navegador, sem uso de terminal ou prompts manuais.

**Problema principal:** O fluxo atual exige que Max cole prompts manualmente em chats de IA, sem persistência, sem mockup visual e sem pipeline estruturado.
**Público:** Max Linder de Moura Campos (1 usuário principal, não-técnico).
**Proposta de valor:** Interface visual que substitui o trabalho manual de prompts e organiza todo o processo de produção de conteúdo em um único lugar.

---

## Problem Statement

Max opera o sistema de conteúdo do @residenciaemfinancas colando prompts manualmente em sessões de chat com Claude. O processo tem 5 etapas:

1. Pesquisar trending topics (manual, sem ferramenta)
2. Gerar copy via Claude com persona Leandro Ladeira (colando prompt longo)
3. Revisar e aprovar a copy (sem mockup visual)
4. Gerar imagens (plataformas separadas)
5. Organizar posts no pipeline (sem sistema)

**Impacto atual:**
- Frição alta: cada sessão exige cole de prompts extensos
- Sem persistência: histórico de posts e aprovações se perde
- Sem visualização: a copy não é visualizada como um post real do Instagram
- Sem pipeline: não há controle de pending/approved/published
- Usuário não-técnico não consegue operar sem suporte técnico constante

**Por que agora:** O fluxo está criado (tone_guide, prompts, agente Leandro Ladeira), mas sem interface, Max não consegue operar de forma independente e escalável.

---

## Proposed Solution

Aplicação web (Next.js + Vercel) com 5 módulos interligados:

1. **Research** — Pesquisa automatizada de trending topics via Perplexity/Gemini API. Cards visuais para seleção. Também aceita input manual de tema ou rascunho de copy do próprio Max.

2. **Copy Studio** — Tema escolhido → usuário seleciona formato + voz → Claude API gera 3 ideias usando persona Leandro Ladeira + contexto completo do brief.yaml do @residenciaemfinancas.

3. **Review** — Mockup visual do post (simulação de feed do Instagram). Edição inline. Botões: Aprovar / Rejeitar / Pedir nova versão.

4. **Image Studio** — Copy aprovada → geração de imagem em múltiplos modelos (DALL-E 3, Ideogram, NanoBanana). Seleção visual da imagem final.

5. **Pipeline** — Kanban: Pending → Approved → Published. Histórico completo de posts gerados.

**Diferencial:** Tudo em uma tela, sem terminal, sem colar prompts, com visualização real do post antes de publicar.

---

## Target Users

### Primary: Max Linder de Moura Campos
- **Perfil:** Fundador do Residência em Finanças, CFP®, não-técnico em desenvolvimento de software
- **Comportamento atual:** Opera no Claude via chat, copia e cola prompts manualmente
- **Dores específicas:** Frição de setup por sessão, sem histórico, sem visualização, sem pipeline
- **Goal:** Produzir 2-3 posts/dia de forma independente, sem suporte técnico

### Secondary: Squads de conteúdo (futuro)
- Designers e redatores que podem usar o pipeline para receber briefings e entregar designs

---

## Goals & Success Metrics

### Business Objectives
- Reduzir tempo de produção de 1 post de ~30min (com setup de prompts) para <10min
- Produzir 2-3 posts/dia de forma sustentável sem suporte técnico externo
- Ter pipeline visual com histórico de pelo menos 30 dias de posts

### User Success Metrics
- Max consegue operar o app sozinho sem instrução após onboarding inicial
- Max aprova/rejeita copy sem editar o JSON manualmente
- Imagens geradas com 1 clique, sem sair do app

### KPIs
- **Time-to-post:** tempo entre abertura do app e post aprovado com imagem < 10 min
- **Posts/semana:** meta de 15+ posts aprovados/semana (2-3/dia)
- **Taxa de aprovação de copy:** >60% das copies geradas aprovadas na primeira tentativa

---

## MVP Scope

### Core Features (Must Have)

- **Research Module:** Input de trending topics via Perplexity ou Gemini API + input manual de tema
- **Copy Generation:** Claude API com persona Leandro Ladeira + contexto do brief.yaml integrado, 3 ideias por tema, seleção de formato (carrossel/reels/estático/stories) e voz (Max/Rian/Marca)
- **Review & Edit:** Mockup visual de post Instagram, edição inline de texto, botões Aprovar/Rejeitar
- **Image Generation:** Google Imagen (NanoBanana) como principal. DALL-E 3 como fallback enquanto endpoint do Imagen é confirmado.
- **Pipeline Kanban:** 3 colunas — Pending / Approved / Published
- **Persistência:** Vercel KV para salvar posts e status

### Out of Scope para MVP
- Publicação automática no Instagram (agendamento via API do Instagram)
- Multi-usuário / autenticação de múltiplos membros de squad
- NanoBanana (API desconhecida — integrar após Max fornecer documentação)
- Analytics de engajamento
- Integração direta com ManyChat
- Editor de design avançado (Canva-like)

### MVP Success Criteria
Max consegue ir de "nenhum tema" até "post aprovado com imagem gerada" em menos de 10 minutos, sem abrir terminal, sem colar prompts manualmente, e o post fica salvo no pipeline.

---

## Post-MVP Vision

### Phase 2
- Publicação agendada via Instagram Graph API
- NanoBanana integrado como gerador principal de imagens
- Compartilhamento de posts aprovados com designers via link
- Sugestão automática de horário de publicação baseado em dados de engajamento

### Long-term Vision (1-2 anos)
- Sistema de squads: @pm agenda → @designer recebe briefing → entrega no pipeline
- Analytics integrado: correlacionar copy com engajamento real dos posts
- Extensão para outros perfis além do @residenciaemfinancas

### Expansion Opportunities
- Licenciar o sistema para outros criadores de conteúdo financeiro
- Integração com outros infoprodutores que usam ManyChat + Instagram

---

## Technical Considerations

### Platform Requirements
- **Target:** Web (desktop-first, responsivo para tablet)
- **Browser:** Chrome, Safari, Edge (últimas 2 versões)
- **Performance:** Geração de copy < 15s, geração de imagem < 30s (timeout visual)

### Technology Preferences
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes (serverless — nativo Vercel)
- **Database:** Vercel KV (Redis) para pipeline de posts
- **Hosting:** Vercel (deploy automático via GitHub)
- **AI — Copy:** Anthropic Claude API (`claude-sonnet-4-6`)
- **AI — Research:** Gemini API com Google Search grounding (MVP) — Apify para scraping real de social media na Phase 2
- **AI — Image:** Google Imagen (NanoBanana) como principal — endpoint exato a confirmar via Vertex AI ou ImageFX

### Architecture Considerations
- **Repositório:** Monorepo Next.js (app + API routes no mesmo projeto)
- **Serviço:** Serverless functions para chamadas de API (sem servidor dedicado)
- **Integração:** brief.yaml do @residenciaemfinancas embutido como contexto fixo nas chamadas Claude
- **Segurança:** API keys em Vercel Environment Variables (nunca no cliente)

---

## Constraints & Assumptions

### Constraints
- **Budget:** Sem orçamento definido — preferência por planos gratuitos/baratos (Vercel hobby, Vercel KV free tier)
- **Timeline:** MVP funcional o quanto antes para Max começar a produzir conteúdo
- **Resources:** 1 desenvolvedor (Claude/AIOS) + 1 product owner (Max)
- **Technical:** NanoBanana sem documentação disponível — não entra no MVP

### Key Assumptions
- Max tem ou consegue criar contas nas APIs necessárias (Anthropic, OpenAI, Ideogram, Perplexity/Google)
- Max tem ou consegue criar conta no Vercel e conectar ao GitHub
- O brief.yaml do @residenciaemfinancas é estável o suficiente para ser embutido no app
- Vercel KV free tier é suficiente para o volume inicial (< 100 posts/mês)

---

## Risks & Open Questions

### Key Risks
- **Google Imagen (NanoBanana) — endpoint a confirmar:** É um produto Google, mas o acesso exato (Vertex AI, ImageFX API ou outro) precisa ser validado. Mitigação: DALL-E 3 como fallback na implementação inicial enquanto o Imagen é configurado.
- **Custos de API:** Uso intensivo de Claude + DALL-E pode gerar custos altos. Mitigação: monitorar tokens por request, usar claude-haiku para rascunhos.
- **Latência de geração de imagem:** DALL-E 3 pode demorar 20-40s. Mitigação: loading state visual claro, geração assíncrona.
- **Qualidade do prompt de imagem:** A descrição visual gerada pelo Claude pode não ser suficientemente específica para o estilo do @residenciaemfinancas. Mitigação: template de prompt de imagem fixo com diretrizes de marca.

### Open Questions
- Qual API de pesquisa usar: Perplexity (melhor para busca real-time) ou Gemini (mais barato)?
- Max tem conta GitHub para conectar ao Vercel para deploy automático?
- Quais API keys Max já possui?
- NanoBanana: qual é a documentação/site oficial?

### Areas Needing Further Research
- Custo estimado de API por post gerado (Claude tokens + DALL-E por imagem)
- Ideogram API: verificar limites do plano gratuito/pago
- Vercel KV: limites do free tier para o volume esperado

---

## Appendices

### A. Contexto do Projeto
- **Brief do @residenciaemfinancas:** `C:\Users\Max Linder\Projetos_Vibe\insta_ResFin\brief.yaml`
- **Tone guide:** `C:\Users\Max Linder\projetos-vibe\insta_resfin\workflow\tone_guide.md`
- **Agente Leandro Ladeira:** `C:\Users\Max Linder\projetos-vibe\insta_resfin\workflow\agents\leandro_ladeira.md`
- **Mind clone Ladeira:** `C:\Users\Max Linder\Projetos_Vibe\outputs\minds\leandro_ladeira\mind_dna_complete.yaml`

### B. Workflow Aprovado
Trending topics → Copy (3 ideias) → Aprovação → Imagem → Pipeline → Publicação

### C. Decisões já tomadas
- Deploy: Vercel
- Framework: Next.js 14
- Copy AI: Claude API com persona Leandro Ladeira
- Imagem MVP: DALL-E 3 + Ideogram (NanoBanana pós-MVP)

---

## Next Steps

1. @pm cria PRD a partir deste brief (`docs/prd.md`)
2. @pm cria Epic com os 5 módulos quebrados em stories
3. @sm cria stories individuais por módulo
4. @po valida cada story (10-point checklist)
5. @dev implementa story a story
6. @devops deploy no Vercel

---

*Este Project Brief foi gerado por @pm (Morgan) — AIOS v2.0 em modo YOLO. Revisão e aprovação de Max Linder necessária antes do PRD.*
