# Sales Department — Playbook

## What We Do
List products on marketplaces and promote them.

## Marketplace Rules (from brain.md)
- **Primary:** itch.io (API / butler CLI)
- **Secondary:** Gumroad (API)
- Max 1 listing per day per marketplace
- Always disclose AI involvement
- Never spam or mislead buyers

## Our Specialists
| Specialist | Calls | Output |
|-----------|-------|--------|
| `lister` | `POST /api/agents/listing` | Listing copy for marketplace |
| `publish` | `POST /api/agents/orchestrator` (finalize) | Published product on itch.io |

## Listing Requirements
- Title under 80 chars, SEO-friendly
- 2-3 paragraph description
- 5-10 relevant tags
- AI disclosure: "Graphics: AI-generated with human curation"
- Price $2.99–$7.99 per pack

## Handoff from Product
When Product finishes a pack, they write the pack ID to our inbox. We generate the listing, publish to marketplace, and report back.
