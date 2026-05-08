# .windsurf/ — Configuración para Cascade / Windsurf

Carpeta con configuración específica del agente Cascade que vive en Windsurf IDE. Las reglas estables del proyecto viven en `AGENTS.md` (raíz). Esta carpeta agrega:

## Contenido

```
.windsurf/
├── README.md           # este archivo
├── rules/              # reglas que Cascade aplica automáticamente
│   ├── analytics-discipline.md   # glob: src/**/analytics/**
│   ├── tenant-isolation.md       # always-on
│   └── typescript-strict.md      # glob: **/*.ts, **/*.tsx
├── workflows/          # workflows operativos invocables vía slash command
│   ├── release-hotfix.md         # /release-hotfix
│   ├── analytics-validation.md   # /analytics-validation
│   └── migrate-evolution-to-cloud.md  # /migrate-wpp-cloud
└── mcp.example.json    # template MCP servers (Supabase, GitHub, Vercel, Meta Ads)
```

## Cómo usar

### Rules
Cascade las consulta automáticamente según su `trigger`:
- `always_on` → siempre activa
- `glob` → cuando se editan archivos que matchean los patrones
- `model_decision` → Cascade decide cuándo cargarlas
- `manual` → solo si se invocan explícitamente

### Workflows
Invocables como slash commands desde el chat (`/release-hotfix`, `/analytics-validation`, etc.).

### MCP servers
Copiar `mcp.example.json` a `mcp.json` y rellenar con claves reales (NO commitear `mcp.json`).

## Mantenimiento

Cuando agregues una rule o workflow nuevo, actualiza este README con el path y trigger.
