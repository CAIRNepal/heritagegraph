# Feature Specification: Grounded Frontend Chatbot

**Feature Branch**: `003-grounded-chatbot`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "Let's focus for making the chatbot on frontend to be fully functional like it using the API endpoints or pages like About us and others to provided the grounded results and use the different branch"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get trustworthy answers in chat (Priority: P1)

A visitor or signed-in user opens the in-product chat, asks a question about heritage content, the organization, or how the product works, and receives an answer that clearly reflects the product’s own published information and data (not generic or obviously invented detail).

**Why this priority**: This is the core value of a “grounded” assistant; without it, the feature fails its purpose.

**Independent Test**: A tester can open chat, ask several questions answerable from existing public site pages or from the product’s normal heritage and catalog data access, and confirm answers align with those sources (same facts, no contradiction).

**Acceptance Scenarios**:

1. **Given** the product exposes heritage-related facts through its normal data access, **When** the user asks a question that is answerable from that data, **Then** the chat response reflects those facts in substance (not a conflicting story).
2. **Given** the site has informational pages (for example, About) with fixed wording, **When** the user asks what the product or mission is, **Then** the answer is consistent with those pages, including named concepts where appropriate.
3. **Given** a question that nothing in the approved sources can answer, **When** the user sends it, **Then** the assistant avoids inventing specifics and either gives a high-level, honest limitation or points the user to where to learn more, without fabricating details.

---

### User Story 2 - Chat is usable as a first-class part of the UI (Priority: P2)

A user can start a conversation, see responses in order, recover from common failures, and still complete their goal (understand content or get directed to the right place).

**Why this priority**: A “fully functional” chat must be reliable enough for day-to-day use, not a demo that breaks on errors or empty states.

**Independent Test**: Without touching backend implementation details, a tester can run through a short scripted session (send messages, wait for responses, trigger a network failure) and still receive predictable behavior and messages.

**Acceptance Scenarios**:

1. **Given** the user is on a page where chat is available, **When** they type a message and submit, **Then** they see an explicit sending state, then a reply (or a clear, human-readable error if the service cannot answer).
2. **Given** the product’s data or pages temporarily cannot be used, **When** the user asks a grounded question, **Then** the user sees a clear failure message and is not left with a silent or stuck UI.
3. **Given** a long or multi-step answer is returned, **When** the user reads the thread, **Then** messages stay in the correct order and the latest reply is easy to find.

---

### User Story 3 - Answers stay within the “approved” information set (Priority: P3)

Stakeholders (product or curators) can be confident that chat behavior is tied to the same information users would get from the site and official data, reducing reputational and factual risk.

**Why this priority**: Grounding is partly a trust and quality bar for public-facing content.

**Independent Test**: A reviewer samples questions across “About/mission” topics, heritage facts from the product’s data, and edge questions; they record whether answers stay on-source or properly defer.

**Acceptance Scenarios**:

1. **Given** a question that could invite speculation (for example, unverifiable history), **When** the user asks in chat, **Then** the assistant does not state uncertain claims as fact and stays within what sources support.
2. **Given** updated content on a key public page, **When** a corresponding question is asked after that content is live, **Then** the answer reflects the updated messaging within a reasonable publication lag defined by the product’s normal update process.

---

### Edge Cases

- The user sends an empty or whitespace-only message; the product does not treat it as a valid send or shows a gentle validation state.
- The user sends very long input; the product either accepts within defined limits or explains the limit without crashing.
- Partial or rate-limited access to data sources: the user still gets a clear outcome (retry, shorter answer, or “unavailable” messaging).
- The user asks in a language other than the product’s default; behavior is defined by assumptions below (no silent wrong-language fabrication).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The in-product chat MUST be available wherever the product already intends it to be shown, and a user MUST be able to complete a full send → receive (or error) cycle without a broken interface.
- **FR-002**: The assistant MUST use the product’s published informational pages and the information retrievable through the product’s public or authenticated data access (as appropriate to the user’s context) as the primary basis for factual answers, so that answers do not contradict those sources for the same topic.
- **FR-003**: The assistant MUST treat catalog- or record-backed heritage facts (from the product’s normal data access) and static site pages (such as “About us” and similar) as part of a single approved information set, prioritizing official content when a conflict could arise.
- **FR-004**: When the approved information set does not contain an answer, the system MUST not fill gaps with made-up names, dates, or policies; it MUST acknowledge limits or direct users to authoritative places (e.g. relevant page or help path) in plain language.
- **FR-005**: The chat experience MUST show loading and completion states, preserve message order, and surface user-visible errors when a response cannot be produced, including timeouts or service unavailability.
- **FR-006**: The product owner MUST be able to verify alignment between chat answers and sources using repeatable checks (for example, scripted questions with expected themes or fact patterns), even if the exact technical mechanism of retrieval is left to design.

### Constitution-driven Constraints *(mandatory)*

- **C-001**: The implementation MUST NOT introduce committed secrets; any new env vars MUST be added to `.env.example`.
- **C-002**: Frontend network calls MUST use `process.env.NEXT_PUBLIC_*` configuration (no hardcoded localhost URLs).
- **C-003**: Protected API calls MUST use `Authorization: Bearer <accessToken>` sourced from NextAuth session.
- **C-004**: The implementation MUST remain compatible with repository quality gates (ruff for Python; TS build/typecheck for frontend) for touched code.

### Key Entities *(include if feature involves data)*

- **Chat thread**: A sequence of user and assistant messages shown in the product’s chat interface.
- **Approved information sources**: A combination of designated site pages and data from the product’s normal information access paths, scoped by what the user is allowed to see.
- **Grounding outcome**: A reply that is faithful to the approved information sources, or an explicit, honest limit when they do not support an answer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a test set of at least 20 questions drawn from the approved pages and answerable data (mix of “About”-style and heritage facts), at least 90% of chat answers are rated by reviewers as “aligned with sources” in a three-point scale (aligned / partial / not aligned), with no “not aligned” on purely factual, in-source questions.
- **SC-002**: In the same test set, at least 95% of user-visible turns complete within 30 seconds of submit under normal product network conditions, or the user sees an explicit timeout or error message rather than an indefinite wait.
- **SC-003**: In usability testing (or a structured internal walkthrough) with at least 5 tasks (ask X, then Y, then a follow-up), at least 80% of users complete the tasks without reporting that the chat “felt random” or “made things up” about the organization or catalog content.
- **SC-004**: Stakeholder review: zero critical incidents where the chat states as fact a policy, date, or mission element that directly contradicts the public About or equivalent page after that page has been updated and deployed.

## Assumptions

- The product already has (or will have in the same release) a chat entry point; this specification focuses on making it *functionally* grounded and reliable, not on inventing a new brand identity for the assistant.
- The same sign-in and API access rules that apply to the rest of the app apply to chat: visitors see only public-grounded content; signed-in users may see additional context where the product already allows it.
- “Pages like About us” are representative: other similar informational pages (mission, how it works, contact) are in scope the same way when they exist on the site.
- The working language for the initial experience matches the product’s default locale; multi-language support can follow a later spec unless already guaranteed elsewhere.
- Work proceeds on a dedicated feature branch; merging follows the project’s `v1` branch rules.
