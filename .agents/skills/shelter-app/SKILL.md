---
name: shelter-app
description: Use only for work in this animal shelter app, including animal records, intake, foster and adoption workflows, and shelter staff tools.
---

# Shelter app project guidance

This skill applies to this repository only. Follow the repository's current code and explicit product requirements; do not assume shelter policies or workflows that have not been defined.

## Current project shape

- `frontend/` is a JavaScript React app built with Vite.
- `backend/` is a Python FastAPI app.
- The checked-in code is still a starter scaffold. Reinspect the repository before each change; do not assume a database, authentication system, API contract, or test suite exists until the code confirms it.
- The frontend currently exposes `dev`, `build`, `lint`, and `preview` npm scripts. The backend has no test or dependency configuration visible in the current scaffold; verify before choosing commands or libraries.

## Work through the app

- Read repository instructions and inspect the relevant frontend, backend, and API paths before editing.
- Trace feature changes from the React interface through the FastAPI endpoint and persistence layer when one exists. Keep request/response shapes and validation consistent across layers.
- Use the repository's established structure and dependency choices. Avoid adding a database, auth provider, state library, or other dependency without a clear requirement.
- For data-entry and record-management features, include appropriate loading, empty, success, validation, not-found, and failure states. Preserve user input after recoverable submission failures when possible.
- Keep UI changes responsive, accessible, and consistent with existing components and styles.

## Shelter domain and data safety

- Do not invent animal details, medical or behavioral assessments, adoption eligibility, intake statuses, foster rules, or approval policies. Ask when an unclear rule changes records or user decisions.
- Treat adopter, foster, volunteer, and staff information as private. Collect and display only what the feature needs; do not expose personal data in public responses, logs, or client bundles.
- Validate untrusted input in FastAPI as well as in the UI. If authentication or authorization is introduced, enforce access on the server for every protected read and write; UI hiding is not authorization.
- Do not read, print, commit, or expose secrets from `.env`. Preserve existing environment configuration and avoid using real personal or animal records as test fixtures.
- Handle deletes, bulk updates, and status transitions carefully. Preserve existing history and relationships; do not make destructive data or schema changes without explicit authorization.

## Current implementation priority

- Finish the standard CRUD application before integrating AI.
- Build cat record creation, viewing, editing, and archiving first.
- Then add the adopter quiz and deterministic matching.
- Do not add AI providers, API credentials, embeddings, or a vector
  database unless explicitly requested.

## Structured cat records

- Use stable, unique cat IDs; names are not unique identifiers.
- Store age group, companionship style, adoption availability,
  dog/cat/child compatibility, documented care needs, and
  shelter-confirmed placement requirements as structured fields.
- Preserve the original foster description separately.
- Represent compatibility as yes, no, or unknown.
- Distinguish no documented care needs from unknown care needs.
- Store shelter-confirmed bonded groups explicitly; do not infer
  required joint adoption from cats appearing together in a description.
- Treat foster opinions and descriptive text as observations,
  not automatically as confirmed placement restrictions.
- Have staff confirm structured assessments before they affect matching.

## Initial matching implementation

- Implement matching in the FastAPI backend using deterministic
  filtering followed by explicit, configurable preference scoring.
- Only recommend cats whose current availability is confirmed.
- Apply shelter-defined placement restrictions before scoring.
- Do not invent eligibility policies or convert preferences into
  mandatory requirements.
- Keep unresolved compatibility visible as "Needs confirmation."
- Unknown information must not count as a positive or negative match.
- Keep incomplete candidates distinguishable from confirmed matches.

## Adopter journey

- The adopter flow is sign up → complete the quiz → view matches.
- From matches, adopters can optionally bookmark cats or retake the
  quiz to update their preferences and view new matches.
- Adopters can return to their bookmarks later, select a cat, and
  fill out an adoption form for that cat.
- Keep bookmarking separate from applying: saving a match does not
  submit an adoption form.

## Foster and shelter login

- Foster and shelter buttons lead directly to login, rather than
  entering the adopter signup and quiz flow.
- Fosters and shelter users receive separate login links through
  email. Setting up those email login links is deferred until later;
  do not implement that delivery flow unless requested.

## Adopter quiz and preference scoring

- Ask about preferred age groups and companionship styles,
  household dogs, cats and children, and willingness to support
  specific documented care needs.
- Offer "No preference" where appropriate.
- Initial proposed weights:
  - Preferred companionship style: 3 points.
  - Preferred age group: 2 points.
- Treat these weights as configurable starting values, not
  validated shelter policy.
- Award no points for unknown data or "No preference."
- Do not score names, Instagram accounts, or profile wording.
- Return specific reasons and unresolved considerations alongside
  each result.
- Do not present scores as adoption-success probabilities.
- Do not force a recommendation when no suitable candidates exist.

## Future AI enhancement

- Add AI only after CRUD and deterministic matching work.
- AI may explain existing results or suggest structured tags from
  descriptions for staff review.
- AI must not determine eligibility, override restrictions, invent
  facts, or change records without staff confirmation.
- Preserve deterministic results if AI is unavailable.
