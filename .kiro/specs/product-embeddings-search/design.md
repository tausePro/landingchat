# Design Document

## Overview

Implementación de búsqueda semántica de productos usando OpenAI embeddings y pgvector en Supabase. Esto reemplaza la búsqueda actual basada en ILIKE por una búsqueda por similitud de vectores.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Chat Agent    │────▶│  Semantic Search │────▶│    pgvector     │
│  (Claude API)   │     │     Function     │     │   (Supabase)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  OpenAI API      │
                        │  (Embeddings)    │
                        └──────────────────┘
```

## Components and Interfaces

### 1. Database Schema (pgvector)

```sql
-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Agregar columna de embedding a products
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS products_embedding_idx 
ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Función de búsqueda semántica
CREATE OR REPLACE FUNCTION search_products_semantic(
  query_embedding vector(1536),
  org_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  image_url text,
  stock int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.price,
    p.image_url,
    p.stock,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM products p
  WHERE p.organization_id = org_id
    AND p.is_active = true
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 2. Embedding Service (`src/lib/ai/embeddings.ts`)

```typescript
interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>
  generateProductEmbedding(product: Product): Promise<number[]>
  searchProducts(query: string, organizationId: string, limit?: number): Promise<Product[]>
}
```

### 3. Product Hooks (Triggers)

- `afterProductCreate`: Genera embedding para nuevo producto
- `afterProductUpdate`: Regenera embedding si cambia nombre/descripción/categorías

## Data Models

### Product (actualizado)

```typescript
interface Product {
  id: string
  organization_id: string
  name: string
  description: string
  price: number
  stock: number
  categories: string[]
  embedding?: number[] // Vector de 1536 dimensiones
  embedding_updated_at?: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Embedding consistency
*For any* product with name and description, generating an embedding twice with the same input should produce vectors with cosine similarity > 0.99
**Validates: Requirements 1.1**

### Property 2: Search relevance
*For any* search query, the returned products should have similarity scores in descending order
**Validates: Requirements 1.3**

### Property 3: Fallback behavior
*For any* product without embedding, it should still be findable via text-based fallback search
**Validates: Requirements 1.4, 2.4**

## Error Handling

| Error | Handling |
|-------|----------|
| OpenAI API rate limit | Retry con exponential backoff, máximo 3 intentos |
| OpenAI API error | Log error, usar fallback ILIKE |
| pgvector query error | Log error, usar fallback ILIKE |
| Embedding null | Excluir de búsqueda semántica, incluir en fallback |

## Testing Strategy

### Unit Tests
- Generación de embeddings con mock de OpenAI
- Función de búsqueda semántica con datos de prueba

### Property-Based Tests
- Consistencia de embeddings
- Ordenamiento de resultados por similitud
- Fallback a búsqueda de texto

### Integration Tests
- Flujo completo: crear producto → generar embedding → buscar
- Búsqueda semántica vs ILIKE (comparar resultados)
