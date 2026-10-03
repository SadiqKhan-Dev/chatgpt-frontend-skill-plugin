# Difficulty levels

Difficulty changes how a skill is written. It never changes which sections are required.

| id             | Label         | Also accepts                                            |
| -------------- | ------------- | ------------------------------------------------------- |
| `beginner`     | Beginner      | `junior`, `entry level`, `entry-level`, `basic`, `novice`, `fundamentals` |
| `intermediate` | Intermediate  | `mid level`, `mid-level`, `standard`, `working knowledge` |
| `advanced`     | Advanced      | `expert`, `senior`, `deep dive`, `deep-dive`            |

Validate a user-supplied level with:

```bash
node scripts/validate-skill.mjs --difficulty expert
```

An unrecognised level is an error. Ask the user which of the three they meant rather than picking the
nearest.

## Beginner

**Reader assumption:** no prior knowledge of this technology, and possibly no knowledge of the
surrounding ecosystem.

- Expand every acronym on first use.
- Prefer copy-pasteable snippets over elided code. `...` in a beginner skill is a dead end.
- Explain what each step produces before explaining how to do it.
- Include the failure modes a beginner will actually hit, not exhaustive ones.
- Say what to do when a prerequisite is missing rather than assuming it is installed.
- Avoid idioms. If the technology has a beginner trap, name it explicitly.

**Watch for:** a beginner skill that assumes the reader already knows the build tool, the module
format, or the directory convention.

## Intermediate

**Reader assumption:** can use the technology competently, but does not know its ecosystem or its
current conventions.

- Lead with the recommended path, then give the trade-off behind it.
- Name the alternatives and when to reach for them. This is the level where that distinction starts
  to matter.
- Skip fundamentals the reader already has, but keep any concept the workflow depends on.
- Call out breaking changes between major versions, since that is the most likely source of error.
- Include the testing and performance notes a working developer would otherwise miss.

**Watch for:** presenting one approach as the only option, which reads as authoritative and is
misleading at this level.

## Advanced

**Reader assumption:** fluent. Wants internals, edge cases, and the reasoning behind the defaults.

- Lead with the mechanism, then the API.
- Cover the edge cases and failure modes that only appear under load or at scale.
- Include performance and security implications with concrete reasoning, not slogans.
- Discuss the alternatives seriously, including the case for each.
- State the version boundary explicitly. At this level an API detail that changed in the last major
  release is the whole answer.

**Watch for:** padding with generic advice. An advanced skill that explains what a component is has
failed at its job.

## Difficulty does not change

- The 11 required sections.
- The rule against inventing APIs.
- The rule against adding unrequested dependencies.
- The requirement to label assumptions.
- The requirement to preserve existing content when updating.

## Applying difficulty to an existing skill

When changing the difficulty of a skill that already exists, treat it as an `update`, not a
rewrite. Preserve correct content, and report which sections changed and why the new level needed
them to change. A difficulty change is a large, deliberate rewrite of the same skill, not a licence
to replace it.