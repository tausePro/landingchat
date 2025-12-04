# Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── admin/              # Platform admin panel (superuser)
│   ├── api/                # API routes
│   │   └── store/[slug]/   # Public store APIs (chat, categories)
│   ├── auth/               # Auth callback handlers
│   ├── chat/[slug]/        # Chat interface per store
│   ├── dashboard/          # Organization dashboard (authenticated)
│   │   ├── agents/         # AI agent configuration
│   │   ├── customers/      # Customer management
│   │   ├── marketing/      # Coupons, shipping
│   │   ├── orders/         # Order management
│   │   ├── products/       # Product CRUD
│   │   ├── promotions/     # Promotions management
│   │   └── settings/       # Store settings, templates
│   ├── login/              # Login page
│   ├── onboarding/         # New org setup wizard
│   ├── registro/           # Registration page
│   ├── recuperar/          # Password recovery
│   └── store/[slug]/       # Public storefront pages
│
├── components/
│   ├── layout/             # Layout components
│   ├── onboarding/         # Onboarding-specific components
│   ├── shared/             # Shared components
│   ├── store/              # Store-specific components
│   │   └── templates/      # Storefront templates
│   └── ui/                 # Base UI components (shadcn pattern)
│
├── hooks/                  # Custom React hooks
├── lib/
│   ├── ai/                 # Anthropic/Claude integration
│   ├── supabase/           # Supabase client (server/client)
│   └── utils/              # Utility functions
├── store/                  # Zustand stores
└── middleware.ts           # Auth + subdomain routing

migrations/                 # SQL migration files for Supabase
```

## Key Conventions

### Route Organization
- Each route folder contains: `page.tsx`, `actions.ts` (server actions), `components/` (route-specific)
- Dynamic routes use `[param]` folders (e.g., `[slug]`, `[id]`)

### Server Actions Pattern
- Located in `actions.ts` files within route folders
- Use `"use server"` directive
- Handle auth check, fetch org context, perform operation, revalidate paths

### Component Organization
- `src/components/ui/` - Base primitives (button, input, dialog)
- `src/components/shared/` - Reusable across features
- `src/app/**/components/` - Feature-specific components

### Supabase Clients
- `createClient()` - User-authenticated client (respects RLS)
- `createServiceClient()` - Service role client (bypasses RLS)

### Multi-tenancy
- Organizations identified by `organization_id`
- Stores accessed via subdomain or `/store/[slug]`
- Middleware handles subdomain → internal route rewriting
