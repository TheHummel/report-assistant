# LARS - LaTeX Report Assistant

<!-- TODO:

- uses LiteLLM Endpoint
- in deployment mode: uses forward-credentials for DB auth
- System architecture
- mention deployment branch
- mention database setup

-->

An AI-powered LaTeX editor with real-time compilation, designed for scientific report writing and technical documentation.

![System Architecture]()

## Features

### AI-Powered Editing

- **Agent**: Intelligent LaTeX editing assistant powered by LLMs
- **Smart Suggestions**: Context-aware improvements and corrections
- **Image-to-LaTeX**: Convert mathematical equations and diagrams from images to LaTeX code
- **Interactive Chat**: Natural language interface for document editing

### Collaborative Editor

- **Multi-file Projects**: Organize complex documents with multiple .tex files, images, and assets
- **Template System**: Quick-start with pre-configured report templates ([Template Guide](./report-templates/README.md))
- **Real-time Compilation**: Instant PDF preview with integrated LaTeX compiler
- **File Management**: Upload images, organize in folders, import complete projects via ZIP

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+ (or npm/yarn/bun)
- Supabase account (for local development)

### Local Development

1. **Clone and install**

   ```bash
   git clone <your-repo-url>
   cd report-assistant
   pnpm install
   ```

2. **Environment setup**

   ```bash
   cp .env.example .env.local
   ```

   Required variables:

   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

   # AI Provider
   API_URL=https://litellm.your-endpoint.com/v1/chat/completions
   API_KEY=sk-XXX

   # Services
   COMPILE_SERVICE_URL=http://localhost:3001
   AGENT_SERVICE_URL=http://localhost:3002
   ```

3. **Database setup**

   Quick version:

   ```bash
   # Using Supabase CLI
   supabase start
   supabase db push
   ```

4. **Start development**

   ```bash
   # Main app
   pnpm dev

   # Agent server (separate terminal)
   cd agent_server && pnpm dev
   ```

## Documentation

- **[Deployment Guide](./deployment/README.md)** - Production deployment (OpenShift, VM, Docker)
- **[Template Guide](./report-templates/README.md)** - Creating custom LaTeX templates

<!-- ## Tech Stack

**Frontend:**

- Next.js 16 (App Router, React 19)
- TypeScript

**Backend:**

- Supabase (PostgreSQL, Auth, Storage)
- Custom LaTeX compiler

**Infrastructure:**

- OpenShift/OKD (frontend)
- Docker + docker-compose (backend)
- VM deployment (optional) -->

## Project Structure

```
report-assistant/
├── app/                  # Next.js app directory
│   ├── api/              # API routes
│   ├── projects/         # Project editor
│   └── ...
├── components/           # React components
│   ├── chat/             # AI interface
│   ├── editor/           # Monaco wrapper
│   └── ui/               # shadcn components
├── hooks/                # Custom hooks
├── lib/                  # Utilities
│   ├── lars-agent/       # AI logic
│   ├── storage/          # Storage adapter
│   └── supabase/         # Supabase clients
├── actions/              # Server actions
├── stores/               # State management
├── agent_server/         # AI agent service
├── deployment/           # Deployment configs
│   ├── docker-compose.vm.yml
│   ├── scripts/
│   └── README.md
└── report-templates/     # LaTeX templates
```

<!-- ## Storage Architecture

The app supports two storage modes via environment variable:

**Development (Supabase Storage)**

- Files in Supabase Storage buckets
- Automatic URLs and access control
- Default for local dev

**Production (Database Storage)**

- Files as base64 in PostgreSQL
- No external dependencies
- Enable with: `NEXT_PUBLIC_USE_DATABASE_STORAGE=true`

The storage adapter automatically handles both modes.

## Deployment

### CERN OpenShift (OKD)

For production deployment to CERN infrastructure with SSO:

**→ See [Deployment Guide](./deployment/README.md)**

Includes:

- OpenShift frontend deployment
- VM backend setup (PostgreSQL, Auth, LaTeX)
- CERN SSO integration
- Complete configuration -->

## Configuration

### Adding Templates

1. Create folder: `report-templates/my-template/`
2. Add `config.ts` with metadata
3. Add LaTeX files
4. Register in `lib/templates.ts`

See [Template Guide](./report-templates/README.md)

## Acknowledgments

- [octree](https://github.com/octree-labs/octree)

## Other Guides

- 📖 [Database Setup Guide](./DATABASE_SETUP.md)
- 🚀 [Deployment Guide](./deployment/README.md)
