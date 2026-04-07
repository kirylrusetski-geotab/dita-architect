# Acquisition Evaluation: DITA Doer V1 & V3 (Beta)

**Date:** 2026-03-10
**Author:** Rafael Santos, Engineering Manager
**Status:** Evaluation complete. Pending action.

---

## Overview

Cybergymnastics acquired two competing products — DITA Doer V1 ("VibeEtto") and DITA Doer V3 (Beta). Both were evaluated for potential absorption into DITA Architect v0.5.0. Four team members conducted parallel reviews:

- **Anna (Staff Engineer):** Architecture audit, both products
- **Elena (Principal Engineer):** Code quality review, both products
- **Maya (UX Engineer):** UX evaluation, both products
- **Rafael (Engineering Manager):** Synthesis and recommendation

Source files archived at: `/Users/kirylrusetski/ai-projects/acquired-products/`

---

## Recommendation

**Absorb neither product wholesale. Extract six specific assets.** Rewrite them to our standards — tests, accessibility, security, TypeScript strict mode.

---

## Product Summaries

### DITA Doer V1 ("VibeEtto")

- Single-pane Monaco XML editor with AI overlay
- Google Gemini integration (`gemini-3-flash-preview`, `@google/genai 0.1.1`)
- AI-powered format conversion, validation, preview
- Monaco DiffEditor for reviewing AI proposals
- Conversational AI assistant ("VibeEtto AI")
- CDN-loaded everything (React 18, Monaco 0.48, Tailwind)

**Scores (Anna):** Code quality 4/10, AI innovation 8/10, Architecture 3/10

**Critical issues:**
- God Component pattern (`App.tsx` ~450 lines, all state and logic)
- XSS vulnerability: `dangerouslySetInnerHTML` with unsanitized AI output in `PreviewModal.tsx`
- API key bundled client-side
- Dead code: `VisualEditor.tsx` (abandoned Lexical stub returning null), empty `DitaNoteNode.ts`, empty `ditaConverter.ts`
- CDN-only dependency loading — no bundler, no tree-shaking
- Zero tests
- No WYSIWYG, no persistence, no CMS integration

**Verdict:** DISCARD as product.

### DITA Doer V3 (Beta)

- Quill 2.0.3 rich text editor + DITA block renderer
- Google Gemini integration (`@google/genai 1.38.0`)
- 3-step ConversionWizard (topic type → AI options → metadata review)
- AI Chat Sidebar ("DITA-Bot") with inline proposal workflow
- localStorage Project Manager with JSZip export
- React 19, TypeScript (non-strict), Vite

**Architecture:**
- Clean `App.tsx` (~70 lines, proper orchestrator)
- Service layer properly extracted (`geminiService.ts`, `projectService.ts`)
- Well-typed domain model in `types.ts` (`DitaBlock`, `DitaStep`, `DitaFile`, `Project`)
- Mega-component in `Editor.tsx` (~1134 lines)

**Critical issues:**
- Regex `lastIndex` bug in `ditaUtils.ts` `serializeContent()` at line 188
- Orphaned `unified-dita-editor.tsx` (1746-line Claude-powered prototype, unused)
- `textAnalysis.ts` identical to DITA Architect's (confirmed: no licensing issue)
- XSS via `dangerouslySetInnerHTML` without sanitization
- API key bundled client-side
- Quill CSS version mismatch
- Zero tests

**Verdict:** DISCARD as product. Better engineered than V1 but still not close to our bar.

---

## Assets to Extract

### HIGH VALUE

| # | Asset | Source | Description | Integration Target |
|---|-------|--------|-------------|--------------------|
| 1 | **AI diff-review workflow** | V1 | Monaco DiffEditor with `review-theme` for AI-propose → diff → accept/reject. The right interaction model for AI-assisted editing. | DITA Architect Monaco pane |
| 2 | **`geminiService.ts` + prompt engineering** | V3 | 156 well-isolated lines. `DITA_SYSTEM_INSTRUCTION` and structured output patterns. Accelerates our AI integration roadmap. | New AI service module |
| 3 | **ConversionWizard (3-step migration)** | V3 | Topic type selection → AI options → metadata review. Maps to guided content migration for new users. ~342 lines. | New first-run / import feature |
| 4 | **ChatSidebar UX pattern** | V3 | AI chat with inline proposal workflow — AI suggests, user reviews in-context. ~249 lines. Design is sound, implementation needs rewrite. | New panel in existing layout |

### MEDIUM VALUE

| # | Asset | Source | Description | Integration Target |
|---|-------|--------|-------------|--------------------|
| 5 | **`ditaUtils.ts` XML parser/serializer** | V3 | 352 lines, mostly solid. **Must fix regex `lastIndex` bug at line 188 before use.** Useful reference for XML handling. | `lib/` utilities |
| 6 | **DownloadWarningModal** | V1 | 51-line validation gate before export. Small, portable, clean. | Export flow |

### EXPLICITLY DISCARD

- CDN-only architecture (V1)
- God Component `App.tsx` (V1)
- Dead Lexical stubs: `VisualEditor.tsx`, `DitaNoteNode.ts`, `ditaConverter.ts` (V1)
- Quill editor infrastructure (V3)
- `unified-dita-editor.tsx` orphaned prototype (V3)
- `textAnalysis.ts` — already ours (V3)
- localStorage persistence model (V3)
- All `dangerouslySetInnerHTML` rendering code (both) — rewrite with DOMPurify

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| XSS via `dangerouslySetInnerHTML` in both products | **Critical** | Do not port any rendering code without DOMPurify sanitization |
| API key bundled client-side (both) | **High** | Our architecture must proxy AI calls server-side |
| Zero test coverage on all extracted code | **High** | Nothing ships without tests written to our standard (239+) |
| Regex `lastIndex` bug in `ditaUtils.ts` line 188 | **Medium** | Fix before any integration; Elena documented exact location |

---

## Roadmap Mapping

**Near-term (fits current roadmap):**
- Integrate AI diff-review workflow into DITA Architect's existing Monaco pane
- Adapt `geminiService.ts` prompts into AI feature branch
- Add DownloadWarningModal to export flow

**Medium-term (new feature work):**
- Build ConversionWizard as first-run / import experience
- Design ChatSidebar as panel in existing layout

**No DevOps assessment needed** — we are porting patterns and small modules, not merging repositories.

**Staffing:** Jamie and Elena pair on extraction work. Estimated scope: one sprint AI integration, one sprint UX features.

---

## Reviewer Reports (Summary)

### Anna — Architecture Audit

**V1:** Scored 4/10 code quality, 8/10 AI innovation, 3/10 architecture. Primary value is Gemini prompt designs and AI-propose-diff-review UX pattern. Everything else is prototype-grade.

**V3:** "Not acquisition-ready as standalone" but contains "highly extractable, high-value IP assets." Identified regex bug, recommended component-by-component integration with priorities. Service layer and type system show meaningful engineering maturity over V1.

### Elena — Code Quality Review

Both products FAIL. V1 has critical security issues (XSS, API key exposure), zero tests, God Component. V3 is better — proper service layer, typed domain model — but same security and test gaps. "V3 is the better foundation if forced to choose."

### Maya — UX Evaluation

V1 useful for diff-based review workflow and download protection gate. V3 brings more strategically valuable capabilities: migration wizard, topic type onboarding, project persistence pattern. Both have poor accessibility (no ARIA labels, no keyboard navigation, insufficient contrast). Identified 10 patterns worth absorbing and 7 patterns that would degrade DITA Architect if ported as-is.
