# Quality rules

The behavioural rules a generated skill must follow. These are what separate a useful skill from a
plausible-looking document.

## 1. Ask for missing critical information

Three inputs are blocking: **technology**, **topic**, **difficulty**.

Everything else is not. Record it as a stated assumption and continue. One short question about the
topic is worth asking; a questionnaire about the tech stack is not.

```markdown
Assumptions:
- This project uses the Next.js App Router, not the Pages Router.
- Styling is Tailwind CSS v4, so there is no tailwind.config.js by default.
```

If an assumption would change the workflow entirely, that is a blocking question. "Are we styling with
Tailwind or CSS modules?" changes every example. "Which Node version?" rarely does.

## 2. Never invent APIs

This is the failure mode that makes a generated skill actively harmful: it reads as authoritative, it
is confidently wrong, and an agent following it produces broken code that looks reviewed.

Rules:

- Verify anything version-specific against official documentation before writing it.
- Prefer describing behaviour over naming an exact call when you cannot verify the call.
- If you cannot verify it, do not write it. Record it as an open question instead.
- Do not invent configuration keys, file names, CLI flags, or lifecycle hooks.

```markdown
<!-- Bad: confident, unverifiable, and wrong the moment the version moves. -->
Set `experimental.optimizePackageImports` in next.config.js.

<!-- Good: states the goal and tells the agent how to confirm it. -->
Route third-party imports through dynamic `import()` at the call site so they are not in the
initial bundle. Confirm the current Next.js configuration surface against the official docs before
adding config keys; prefer the code-level change, which needs none.
```

## 3. Add nothing that was not requested

No state library because React apps usually have one. No router because the app needs navigation. No
test runner because the skill mentions verification.

If a technology genuinely requires a companion tool, name it in `Prerequisites` and say why. That is
different from quietly assuming it.

If the user asks for a React skill and the answer needs routing, say so explicitly rather than
introducing a router:

```markdown
This skill covers component authoring only. Routing, data fetching, and server state are out of scope.
```

## 4. Prefer modern practice, and say why

"Prefer modern practice" without a reason produces cargo-cult advice that ages badly.

- Recommend the current default over a legacy optimisation.
- When you choose the newer option, give the reason in one clause.
- When the legacy option is still correct, say so. Plenty of older advice is fine.

```markdown
- Use `fetch` with an `AbortController` for cancellable requests. `XMLHttpRequest` is only relevant
  when you need upload progress events, which `fetch` still cannot report.
```

## 5. Preserve existing content

Applies to `improve`, `convert`, `from-docs`, and `update`.

- Read the whole existing file before writing anything.
- Change only what the request requires.
- Keep correct sections byte-identical where possible, so the diff shows real change.
- Never regenerate a file from the template during an update. That destroys good content.
- Report what changed and what was deliberately left alone.

If a section is wrong, replace it. If it is right, leave it.

## 6. Keep it production-oriented

- Real failure modes, not theoretical ones.
- Error handling that someone would actually write.
- The state a reader needs to know is not thread-safe.
- What to do when the network fails, the input is malformed, or the list is empty.

## 7. Make it verifiable

A checklist an agent can execute beats one it can only agree with.

```markdown
- [ ] Run `npm run build` and confirm it completes without errors.   <!-- executable -->
- [ ] Confirm the component renders correctly.                      <!-- not executable -->
```

Prefer the first. When the second is unavoidable, name the observable outcome: "the list renders all
12 items from the fixture", not "the list works".

## 8. Label assumptions where they are found

An assumption buried inside a code example is an assumption the reader will treat as fact. Collect
them where they can be seen, either under `Prerequisites` or in a short list directly beneath it.

## Anti-patterns

| Anti-pattern                                     | Why it fails                                                   |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Skill named after the technology                  | `react` never tells an agent when to activate.                   |
| Empty conditional sections                        | Advertises coverage the skill does not have.                    |
| Restating general programming knowledge          | The agent already knows it. The space is wasted.                |
| Advice with no measurement                        | Teaches optimisation as ritual.                                 |
| Version-specific detail from memory               | Silently wrong, and confidently so.                             |
| Rewriting the whole file during an update         | Destroys correct content and buries the real change.            |
| Hedged recommendations with no condition          | "It depends" without saying on what is not decision support.     |