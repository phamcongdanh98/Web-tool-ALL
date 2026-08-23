---
name: project-workflow
description: "Inspect a software repository and create or improve a project-specific AGENTS.md covering architecture, critical flows, real commands, quality gates, Git/CI/deploy, and operational lessons. Use when bootstrapping or standardizing project instructions; do not use for routine feature work that does not require workflow documentation."
---

# Project Workflow

Create an `AGENTS.md` that describes the target repository as it actually works. Use [assets/AGENTS.template.md](assets/AGENTS.template.md) as a starting structure, then remove irrelevant sections and replace every placeholder with evidence from the repository or an explicit user decision.

## Establish the target and authorization

- Confirm the repository root and whether the user wants a new file, an update, a review, or reusable lessons extracted from another project.
- Treat existing `AGENTS.md` files as authoritative within their scope. Do not overwrite or weaken them unless the user explicitly requests that change.
- Inspect read-only before editing. Run the repository's status command first and preserve unrelated local changes.
- Creating instructions does not authorize commit, push, deployment, external messages, production changes, or dependency updates.

## Inspect before writing

Gather only the evidence needed to describe the project:

- Read the existing instructions, README, recent changelog, manifests, lockfiles and environment examples.
- Map entrypoints, main modules, data stores, external services, test directories, CI workflows and deployment files.
- Derive commands from manifests, task runners and CI. Do not invent conventional commands because the stack usually has them.
- Trace at least one critical path from user or caller input through processing and persistence to the observable output.
- Record important limits, cleanup behavior, failure modes, security boundaries and features that are intentionally incomplete.
- Separate confirmed facts, explicit policy, recommendations and unknowns. Resolve material unknowns from local evidence when possible; otherwise mark them clearly.

Search with `rg`/`rg --files` first. Avoid loading generated output, dependencies, secrets, private keys or user data.

## Build the project profile

Tailor the template with:

1. Purpose, scope and non-goals.
2. Runtime, package manager, lockfile, source-of-truth branch and supported environments.
3. A compact repository map that assigns responsibility to real paths.
4. Critical flows and contracts, including client/server, API, database, queue or artifact boundaries as applicable.
5. A command matrix for install, dev, format, lint, typecheck, unit, integration, build, smoke, E2E, audit, status and deploy.
6. Playbooks for starting work, implementing changes, diagnosing failures and operating production.
7. Security, data, migration, retention, cleanup and destructive-action rules proportional to the project.
8. Git/CI/release/deploy rules and a concrete Definition of Done.
9. Known limitations and transferable lessons that change future decisions.

If a command category does not exist, write `Không có` or `Chưa cấu hình`; do not fabricate it. If several package managers or environments exist, give each a separate row or subsection.

## Adapt the flow to the product

Describe the real observable journey, not an abstract architecture diagram alone. Examples of shapes to adapt:

- Web/file tool: select → validate → preview → process → verify output → download.
- SaaS request: UI/API → authorization → service → database/queue → response/event.
- CLI: arguments/stdin → validation → core operation → artifact/stdout → exit status.
- Library: public API → normalization → core logic → returned value/error.

For each critical flow, state where validation happens, what crosses a trust boundary, what success means and how the output is verified.

## Choose transferable lessons carefully

When extracting knowledge from an existing project, or when the target handles files, browser resources, deployment or multiple development machines, read [references/transferable-lessons.md](references/transferable-lessons.md). Apply only lessons that fit the target. Strip product names, personal paths, hosts, ports and implementation-specific dependencies unless the target actually uses them.

Do not turn one past bug or one team's preference into a universal rule. Keep requirements strict only where deviation would create a concrete correctness, security, data-loss or deployment risk.

## Validate the result

Before handing off:

- Confirm every documented path and command against the repository.
- Search for unresolved `{{PLACEHOLDER}}` values and remove or resolve them.
- Ensure no secret, credential, private host, personal path or user data entered the file.
- Ensure unimplemented features and unavailable checks are labeled honestly.
- Run a documentation check such as `git diff --check`; run broader project checks only when code/config/runtime changed or the user requested them.
- Review the diff for unrelated changes and report the exact Git state.

When the skill itself is copied to another machine, install the entire `project-workflow` directory so its asset and reference remain available.
