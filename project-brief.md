KAI Asset Forge — Updated Structured Project Brief
Project Type

AI Multi-Agent Game Asset Production & Selling System

1. Executive Summary
Project Name

KAI Asset Forge

Short Description

KAI Asset Forge is a small-scale AI-powered game asset studio platform where multiple AI agents collaborate to generate, organize, package, and prepare game assets for online selling.

The platform focuses on:

scalable asset production
automated content workflows
AI-assisted product preparation
digital asset monetization

The goal is to create a semi-automated indie asset business powered by specialized AI agents.

2. Main Objective
Primary Goal

Build a beginner-friendly AI business system capable of:

generating game assets
organizing asset libraries
preparing commercial asset packs
generating store listings
assisting online publishing workflows
Secondary Goals
reduce manual repetitive work
create scalable digital products
test AI-agent collaboration workflows
build a monetizable online asset business
3. Target Audience
Customers
indie game developers
Roblox creators
RPG Maker developers
Godot developers
Unity beginners
pixel art hobbyists
Selling Platforms
itch.io
Gumroad
Ko-fi
Unity Asset Store
4. Initial Product Scope
First Product Category
Modular Tamagotchi RPG Asset Packs
Asset Types
creatures
accessories
items
weapons
food
materials
animations
UI icons
Asset Style
Primary Style
pixel art
cute retro
pastel cyber fantasy
tamagotchi-inspired
5. System Overview
Main System Components
Component	Purpose
Frontend Dashboard	Manage assets & workflows
AI Agent System	Execute specialized tasks
Asset Generator	Generate visual assets
Product Builder	Create commercial asset packs
Listing Generator	Generate store descriptions
Firebase Backend	Database, auth & storage
Automation Engine	Run scheduled workflows
6. AI Agent Architecture
Core Agents
6.1 Trend Research Agent
Role

Research profitable asset trends.

Responsibilities
monitor game asset trends
analyze popular tags
identify low-competition niches
suggest product ideas
Outputs
{
  "trend_name": "",
  "market_score": 0,
  "competition_level": "",
  "recommended_pack": ""
}
6.2 Art Director Agent
Role

Maintain visual consistency.

Responsibilities
define art direction
maintain style rules
optimize prompts
enforce visual consistency
6.3 Asset Generator Agent
Role

Generate assets using AI models.

Responsibilities
generate sprites
create variations
generate transparent PNGs
create sprite sheets
Supported Outputs
PNG
WEBP
spritesheet
transparent assets
6.4 Quality Control Agent
Role

Review generation quality.

Responsibilities
detect broken assets
remove duplicates
verify dimensions
verify transparency
score visual quality
6.5 Packaging Agent
Role

Prepare assets for selling.

Responsibilities
organize folders
rename files
generate previews
create ZIP packages
generate README files
6.6 Store Listing Agent
Role

Generate marketplace-ready listings.

Responsibilities
title generation
SEO descriptions
keyword generation
tag suggestions
pricing suggestions
6.7 Marketing Agent
Role

Generate promotional content.

Responsibilities
TikTok scripts
Twitter/X posts
devlogs
captions
hashtags
7. Technical Stack
Frontend
Technology	Purpose
Next.js	Main frontend framework
Tailwind CSS	Styling
shadcn/ui	UI components
Backend
Technology	Purpose
Firebase	Backend platform
Firestore	NoSQL database
Firebase Auth	Authentication
Firebase Storage	Asset storage
Firebase Functions	Backend logic
AI Layer
Technology	Purpose
GPT-5.5	text workflows
Claude	planning & prompting
OpenAI Images	asset generation
Flux	optional image generation
Automation
Technology	Purpose
n8n	workflow automation
Deployment & Version Control
Technology	Purpose
Vercel	frontend deployment
GitHub	source control & version history
8. Frontend Pages
8.1 Dashboard
Features
generation statistics
active workflows
recent assets
agent activity
8.2 Asset Generator Page
Features
prompt input
style selection
generation controls
preview gallery
8.3 Asset Library
Features
asset browser
tagging system
filtering
search system
8.4 Product Builder
Features
drag-and-drop packaging
ZIP export
thumbnail generation
preview generation
8.5 Listing Generator
Features
auto-generated descriptions
SEO optimization
marketplace formatting
8.6 Agent Monitor
Features
active agent status
current tasks
logs
workflow monitoring
9. Firebase Database Structure
Firestore Collections
assets
{
  "name": "",
  "type": "",
  "style": "",
  "previewUrl": "",
  "status": "",
  "createdAt": ""
}
prompts
{
  "promptName": "",
  "promptText": "",
  "modelUsed": "",
  "rating": 0
}
assetPacks
{
  "title": "",
  "description": "",
  "price": 0,
  "status": ""
}
generations
{
  "assetId": "",
  "agentName": "",
  "generationTime": "",
  "qualityScore": 0
}
workflows
{
  "workflowType": "",
  "status": "",
  "assignedAgent": ""
}
10. Core Workflow
Main Asset Pipeline
Trend Research
      ↓
Art Direction
      ↓
Asset Generation
      ↓
Quality Review
      ↓
Packaging
      ↓
Store Listing
      ↓
Marketing Content
11. Automation Workflow
Daily Automation Routine
Daily Tasks
scan trending asset niches
generate product ideas
generate assets
run quality checks
package approved assets
generate social content drafts
12. File Structure
kai-asset-forge/
│
├── app/
│   ├── dashboard/
│   ├── assets/
│   ├── products/
│   ├── agents/
│   └── settings/
│
├── components/
│
├── lib/
│   ├── ai/
│   ├── agents/
│   ├── firebase/
│   ├── prompts/
│   ├── workflows/
│   └── storage/
│
├── functions/
│
├── public/
│
├── automations/
│
├── docs/
│
├── .env.local
│
└── README.md
13. GitHub Workflow
Repository Strategy
Main Branches
Branch	Purpose
main	production-ready code
dev	development testing
feature/*	feature development
Commit Naming Convention
feat: add asset generator
fix: repair firebase auth
ui: improve dashboard layout
agent: add quality control workflow
GitHub Usage
Purposes
version history
rollback safety
collaboration
deployment integration
backup system
14. Vercel Deployment Workflow
Deployment Pipeline
GitHub Push
      ↓
Vercel Detects Changes
      ↓
Automatic Build
      ↓
Production Deployment
Environment Variables
Required Keys
OPENAI_API_KEY=
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
15. MVP Scope
INCLUDED
Features
asset generation
AI agent workflows
prompt management
packaging system
listing generator
dashboard
Firebase integration
GitHub integration
Vercel deployment
EXCLUDED (FOR NOW)
Avoid Initially
autonomous publishing
payment systems
subscriptions
multiplayer collaboration
advanced memory systems
mobile apps
16. Development Roadmap
Phase 1 — Foundation
Goals
setup Next.js
setup Firebase
connect GitHub
deploy to Vercel
Phase 2 — Asset Generation
Goals
image generation integration
asset storage
preview gallery
Phase 3 — AI Agent System
Goals
implement agent workflows
task delegation
workflow tracking
Phase 4 — Product Packaging
Goals
ZIP export
thumbnail generation
README generation
Phase 5 — Marketplace Preparation
Goals
listing generator
SEO optimization
pricing suggestions
Phase 6 — Automation
Goals
scheduled workflows
daily asset generation
content automation
17. Recommended Development Workflow
AI Coding Workflow
Main Tools
Tool	Purpose
Cursor	coding
Claude	planning
GitHub	code tracking
Vercel	deployment
18. Success Metrics
KPI	Goal
Assets Generated Daily	10+
Product Packs Per Week	2–5
Marketplace Uploads Monthly	10+
Social Content Posts Weekly	7+
19. Final Vision

KAI Asset Forge evolves into:

a semi-autonomous indie asset studio
an AI-powered asset pipeline
a scalable digital product business

The long-term goal is:

generating and selling game-ready assets continuously using coordinated AI agents while maintaining human creative direction.