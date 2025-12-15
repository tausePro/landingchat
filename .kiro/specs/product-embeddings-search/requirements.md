# Requirements Document

## Introduction

Este feature implementa búsqueda semántica de productos usando embeddings vectoriales con pgvector en Supabase. El objetivo es mejorar significativamente el tiempo de respuesta del chat AI y la calidad de las búsquedas de productos, permitiendo que consultas como "algo para el cabello" encuentren shampoos, acondicionadores, etc.

## Glossary

- **Embedding**: Representación vectorial de texto que captura su significado semántico
- **pgvector**: Extensión de PostgreSQL para almacenar y buscar vectores
- **Búsqueda semántica**: Búsqueda basada en significado, no solo coincidencia de texto
- **OpenAI Embeddings**: API de OpenAI para generar embeddings de texto (text-embedding-3-small)
- **Cosine Similarity**: Métrica para medir similitud entre vectores

## Requirements

### Requirement 1

**User Story:** Como sistema de chat AI, quiero buscar productos por significado semántico, para que los clientes encuentren productos relevantes aunque no usen las palabras exactas.

#### Acceptance Criteria

1. WHEN a product is created or updated THEN the system SHALL generate an embedding vector combining name, description, and categories
2. WHEN the AI searches for products THEN the system SHALL use cosine similarity to find the most relevant products
3. WHEN searching with semantic queries THEN the system SHALL return products ranked by relevance score
4. IF the embedding generation fails THEN the system SHALL fall back to text-based search (ILIKE)

### Requirement 2

**User Story:** Como administrador de tienda, quiero que los embeddings se generen automáticamente, para no tener que hacer trabajo manual.

#### Acceptance Criteria

1. WHEN a new product is created THEN the system SHALL automatically generate its embedding
2. WHEN a product's name, description, or categories change THEN the system SHALL regenerate its embedding
3. WHEN bulk importing products THEN the system SHALL queue embedding generation to avoid rate limits
4. IF a product has no embedding THEN the system SHALL exclude it from semantic search but include it in fallback text search

### Requirement 3

**User Story:** Como usuario del chat, quiero respuestas más rápidas, para tener una mejor experiencia de compra.

#### Acceptance Criteria

1. WHEN processing a chat message THEN the system SHALL NOT load all products into memory
2. WHEN the AI needs product information THEN the system SHALL use semantic search to fetch only relevant products
3. WHEN searching products THEN the system SHALL return results in less than 200ms
4. WHEN the chat initializes THEN the system SHALL only load the current product context if provided
