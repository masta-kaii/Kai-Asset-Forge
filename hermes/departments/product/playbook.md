# Product Department — Playbook

## What We Do
We generate, curate, and package game assets ready for sale.

## Success Metrics
- 3+ assets generated per forge cycle
- Curator pass rate > 60%
- All assets post-processed to pixel art
- Packs have consistent themes and styles

## Our Specialists
| Specialist | Calls | Output |
|-----------|-------|--------|
| `ideate` | `POST /api/agents/scout` with theme | Product proposal |
| `art-direct` | Internal prompt crafting | Art direction brief |
| `forge` | `POST /api/agents/generate` | Generated assets in Firebase |
| `curate` | `POST /api/agents/curator` | Quality scores per asset |
| `package` | `POST /api/agents/orchestrator` | Created pack in Firestore |

## Workflow
```
ideate → art-direct → forge (×N assets) → curate → package → handoff to Sales
```

## Quality Standards
- All assets must pass Curator (6+/10)
- Packs must have 2-4 cohesive assets
- Preview image must be representative
- Pixel art post-processing applied
