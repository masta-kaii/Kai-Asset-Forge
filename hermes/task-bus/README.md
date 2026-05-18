# Task Bus

The filesystem-based communication layer for Hermes agents.

## Structure
```
/srv/agent-bus/
├── orchestrator/
│   ├── inbox/          ← Operator writes tasks here
│   ├── working/        ← Orchestrator moves tasks here while processing
│   ├── outbox/         ← Orchestrator writes results here
│   └── archive/        ← Completed tasks moved here
├── product/
│   ├── inbox/          ← Orchestrator dispatches product tasks
│   ├── outbox/         ← Product agents write results
│   └── archive/
├── sales/
│   ├── inbox/          ← Orchestrator dispatches sales tasks
│   ├── outbox/         ← Sales agents write listings
│   └── archive/
├── ops/
│   ├── outbox/         ← Monitor writes health reports
│   └── archive/
└── support/
    ├── inbox/          ← Buyer messages
    ├── outbox/         ← Drafted responses
    └── archive/
```

## Task File Format
```markdown
# Task: {title}
- **From:** {operator/orchestrator}
- **Priority:** {low/normal/high/urgent}
- **Created:** {ISO timestamp}

{task description / parameters}
```

## Result File Format
```markdown
# Result: {title}
- **Completed:** {ISO timestamp}
- **Status:** {success/failed/needs-review}

{result content}
```
