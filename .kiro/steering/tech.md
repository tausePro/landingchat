# Tech Stack & Build System

## Core Framework
- **Next.js 16** (App Router) - React 19
- **TypeScript** (strict mode enabled)
- **Tailwind CSS v4** with PostCSS

## Backend & Database
- **Supabase** - PostgreSQL database, authentication, storage, RLS policies
- **Anthropic Claude** - AI chat agent (`@anthropic-ai/sdk`)

## UI Components
- **shadcn/ui** pattern with Radix UI primitives
- **Lucide React** for icons
- **Sonner** for toast notifications
- **next-themes** for dark mode

## State Management
- **Zustand** for client-side global state (cart)
- **Server Actions** for data mutations
- **React Server Components** for data fetching

## Utilities
- **Zod** for validation
- **date-fns** for date formatting
- **clsx + tailwind-merge** for className composition
- **use-debounce** for input debouncing
- **papaparse** for CSV parsing

## Common Commands

```bash
# Development
npm run dev          # Start dev server (localhost:3000)

# Build & Production
npm run build        # Production build
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Environment Variables
Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

## Path Aliases
- `@/*` maps to `./src/*`
