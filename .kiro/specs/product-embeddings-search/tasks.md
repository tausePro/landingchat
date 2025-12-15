# Implementation Plan

- [ ] 1. Setup pgvector en Supabase
  - [x] 1.1 Crear migración para habilitar extensión vector y agregar columna embedding
    - Habilitar `CREATE EXTENSION IF NOT EXISTS vector`
    - Agregar columna `embedding vector(1536)` a products
    - Crear índice ivfflat para búsqueda rápida
    - Crear función `search_products_semantic`
    - _Requirements: 1.1, 1.2_

- [ ] 2. Implementar servicio de embeddings
  - [ ] 2.1 Crear cliente de OpenAI para embeddings
    - Instalar `openai` package
    - Crear `src/lib/ai/embeddings.ts` con función `generateEmbedding`
    - Usar modelo `text-embedding-3-small` (1536 dimensiones)
    - _Requirements: 1.1_
  
  - [ ] 2.2 Crear función para generar embedding de producto
    - Combinar name + description + categories en texto
    - Llamar a OpenAI para generar embedding
    - Manejar errores y rate limits
    - _Requirements: 1.1, 2.1_

  - [ ] 2.3 Crear función de búsqueda semántica
    - Generar embedding del query
    - Llamar a función SQL `search_products_semantic`
    - Implementar fallback a ILIKE si falla
    - _Requirements: 1.2, 1.3, 1.4_

- [ ] 3. Integrar con flujo de productos
  - [ ] 3.1 Generar embedding al crear producto
    - Modificar `createProduct` action para generar embedding
    - Hacer la generación async para no bloquear UI
    - _Requirements: 2.1_

  - [ ] 3.2 Regenerar embedding al actualizar producto
    - Detectar cambios en name/description/categories
    - Regenerar embedding solo si hay cambios relevantes
    - _Requirements: 2.2_

  - [ ] 3.3 Crear script para generar embeddings de productos existentes
    - Script SQL/TS para procesar productos sin embedding
    - Procesar en batches para evitar rate limits
    - _Requirements: 2.3_

- [ ] 4. Optimizar chat-agent
  - [ ] 4.1 Remover carga de todos los productos
    - Eliminar query que carga todos los productos al inicio
    - Solo cargar currentProduct si existe
    - _Requirements: 3.1, 3.2_

  - [ ] 4.2 Actualizar tool search_products para usar búsqueda semántica
    - Reemplazar ILIKE por llamada a searchProductsSemantic
    - Mantener fallback a ILIKE si no hay embeddings
    - _Requirements: 1.2, 3.3_

  - [ ] 4.3 Actualizar system prompt
    - Remover referencia a "catálogo completo"
    - Indicar que debe usar search_products para encontrar productos
    - _Requirements: 3.2_

- [ ] 5. Checkpoint - Verificar funcionamiento
  - Probar búsqueda semántica en chat
  - Verificar tiempos de respuesta
  - Confirmar fallback funciona
