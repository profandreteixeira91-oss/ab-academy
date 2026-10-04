# AB Academy — Engineering Agent Rules

These instructions are mandatory for AI coding agents working in this repository.

## Mandatory cycle

Always follow: AUDIT -> UNDERSTAND -> PLAN -> MODIFY -> BUILD/LINT -> RE-AUDIT -> CONCLUDE.

Do not implement first and diagnose later.

## Audit before modifying

Before changing code:
- Inspect the existing implementation and directly related files.
- Identify callers, dependencies, hooks, state, types, routes, services and Supabase queries.
- Search the repository for existing implementations before creating new ones.
- Reuse existing components, services, hooks and utilities whenever possible.
- Check current business rules and the impact on desktop, mobile and auth flows.
- For database-backed features, inspect the existing Supabase schema, relationships and RLS/policies before creating anything.

Never invent a table, column, function, route, API, environment variable or business rule when the repository can be inspected.

## Surgical changes only

Unless explicitly requested:
- Do not redesign the interface.
- Do not replace libraries.
- Do not rewrite whole files when a localized change is sufficient.
- Do not remove existing functionality.
- Do not alter pricing, authentication, permissions, payment flows or business rules.
- Do not create duplicate modules, routes, components, tables or services.
- Preserve existing visual identity and responsive behavior.

## React and TypeScript safety

Before completion, inspect for:
- unclosed JSX;
- adjacent JSX without a valid parent;
- mismatched braces or parentheses;
- invalid async/await usage;
- incorrect hook dependencies;
- duplicated effects or requests;
- null/undefined failures;
- TypeScript errors;
- invalid imports/exports;
- missing variables;
- broken route parameters;
- stuck loading/error states.

Never remove an await, validation or error handler merely to silence a compiler error. Fix the underlying structure.

## Mandatory validation

Use the actual scripts in package.json.

Current project validation:
- npm run build
- npm run lint

There is currently no dedicated typecheck or test script. Do not invent one.

The build must pass before a task is considered complete.

If validation fails:
1. Reproduce the failure.
2. Identify the root cause.
3. Fix the cause rather than masking the error.
4. Run validation again.
5. Re-audit the affected flow.

## Behavioral validation

A successful build does not prove the feature works.

For affected flows verify initial state, loading, success, error, empty data, missing data, refresh, authentication boundaries, navigation, mobile, desktop, duplicate submissions and concurrency where applicable.

## Supabase

Supabase is a core backend of AB Academy.

Before modifying database behavior:
- inspect existing tables and columns;
- inspect relationships and existing queries;
- inspect RLS and policies when relevant;
- inspect Edge Functions when relevant;
- inspect existing types/interfaces;
- reuse existing structures;
- avoid duplicate tables, columns, policies, functions and services.

Never weaken security or bypass RLS just to make a feature work.

## Matrícula business rules

The matrícula flow is business-critical and must not be changed without explicit authorization.

Flow:
 /planos -> seleção do plano -> escolha inteligente do horário -> dados pessoais -> revisão -> pagamento -> conclusão

Modalities are independent:
- individual: capacity 1;
- dupla: capacity 2;
- grupo/trio: capacity 3.

Never mix modalities.

Dupla:
- A new double can start with 1/2.
- While forming, the first student pays 90% of the individual 1x/week price.
- If a compatible existing double has a vacancy, the new student joins it and pays the configured regular double price.
- At 2/2, regular double price applies from the next billing cycle.
- Never apply a retroactive price change.

Grupo/Trio:
- A new group can start with 1/3 or 2/3.
- While forming, the first student pays 90% of the individual 1x/week price.
- If a compatible existing group has a vacancy, the new student joins it and pays the configured regular group price.
- At 3/3, regular group price applies from the next billing cycle.
- Never apply a retroactive price change.

Availability:
- Supabase/backend is the source of truth for capacity, availability, modality, formation status, participants, teacher, schedule and price.
- Revalidate the selected schedule before final confirmation.
- Concurrent attempts for the last place must be resolved by the backend; never allow over-capacity enrollment.
- Do not duplicate a compatible collective class when an existing compatible formation/class can be reused.

## Payments

Do not replace the existing payment gateway unless explicitly requested.

Preserve financial history. Formation-to-regular price changes apply only to future billing cycles.

Never silently modify historical financial records.

## Authentication

AB Academy uses native Supabase Auth. Do not reintroduce another auth provider unless explicitly requested.

Protected operations must enforce authorization server-side, not only by hiding UI controls.

## Error recovery

When a recent change causes a failure:
- inspect the actual error;
- compare with the previous working implementation when available;
- identify the smallest safe correction;
- avoid unrelated refactors;
- validate the corrected flow again.

If a new change is unnecessary and causes instability, prefer reverting it over adding complexity.

## Completion criteria

A task is complete only when:
- the requested change is implemented;
- relevant existing behavior is preserved;
- JSX and TypeScript structure is valid;
- npm run build passes;
- npm run lint passes;
- affected business flows are re-audited;
- no known regression introduced by the change remains.

If a validation could not be performed, state exactly which one and why.

## Final principle

Work like a maintainer of an existing production system, not like a developer starting a new project.

Audit first.
Change the minimum necessary.
Validate immediately.
Re-audit before declaring success.

## Production baseline protection

The current `main` branch is a production baseline and must be treated as protected working code.

Before any new change:
- Identify the exact files and behavior that are in scope.
- Do not modify unrelated working code, even if it appears improvable.
- Do not perform opportunistic refactors, dependency upgrades, formatting rewrites or architectural changes outside the request.
- Compare the affected implementation with the current baseline before editing when the area has recent fixes.
- Prefer a minimal, isolated commit for each logical correction.

Recovery:
- Stable states must be preserved by a dedicated Git reference before risky work.
- If a change introduces regression, prefer reverting the isolated change or restoring the last known-good baseline rather than layering compensating complexity.
- Never rewrite history or force-update a stable reference unless explicitly authorized.

Change boundary:
- A task must not alter another module merely because it shares a component, stylesheet or utility, unless the dependency is proven to be the direct cause of the requested issue.
- If a requested correction requires touching shared code, audit all known consumers before modifying it and re-audit them afterward.
- Preserve existing business rules, authentication, authorization, payments, enrollment, scheduling and classroom behavior unless the task explicitly changes them.

Validation:
- After every production-impacting change, run `npm run build` and `npm run lint` when the environment permits.
- If validation cannot be executed, do not claim it passed; record the limitation and perform the strongest available static re-audit.

