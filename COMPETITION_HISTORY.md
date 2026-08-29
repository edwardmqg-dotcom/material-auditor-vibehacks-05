# Competition development history

This public repository contains an audited release tree plus the sanitized history of the original VibeHacks #05 development repository.

The competition work began after the official 2026-08-28 18:00 start time. The original commit timestamps and subjects are preserved in the second-parent history of the merge commit. Commit hashes changed because the following non-product material was removed before publication:

- internal execution plans and status notes;
- social-account operating notes;
- the event-guide working summary and pitch script;
- the real Sites project binding;
- local generation scripts, duplicate outputs and task-specific paths.

The published history retains the synthetic test specification, review schema and prompt/interface design notes, followed by the interactive browser application and its fully synthetic demo files.

| Original commit | Sanitized public commit | Time (Asia/Shanghai) | Subject |
| --- | --- | --- | --- |
| `4b77a49` | `613e4c9` | 2026-08-28 20:58:05 | `chore: add material auditor brief and synthetic demo kit` |
| `4bcb762` | `f5cb47b` | 2026-08-28 20:58:32 | `feat: build interactive material audit MVP` |
| `62154cb` | `6b2e226` | 2026-08-28 21:02:11 | `chore: bind public Sites deployment` |
| `52573cc` | `ab75f45` | 2026-08-28 21:02:51 | `docs: record MVP completion and deployment` |
| `762806f` | `c8004ac` | 2026-08-28 21:04:56 | `docs: add three-minute pitch and submission pack` |
| `c5e2096` | `d187d2c` | 2026-08-28 21:16:47 | `docs: add competition repository README` |

Some documentation-only commits are empty after sanitization because every file changed by that commit was intentionally excluded. They remain in the graph so the published timeline stays faithful to the original development sequence.

The current `main` tree is the separately audited release version. It removes deployment identifiers and internal material, upgrades dependencies, documents third-party licensing, and keeps only the files needed to build and evaluate the product.
