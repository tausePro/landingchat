# Implementation Plan: Storefront Home

## Goal
Implement a branded "Storefront Home" at `/store/[slug]` that serves as the landing page for a business. It should display the business logo, a hero section (featured product), and a grid of products, matching the design of the "Stitch Conversational E-commerce (4)" prototype.

## Prototype Reference
- **File**: `prototypes/stitch_landingchat_conversational_e_commerce/Stitch Conversational E-commerce (4)/code.html`
- **Key Elements**:
  - **Header**: Logo (SVG in prototype, will use `organization.logo_url`), Navigation, Cart/Wishlist icons.
  - **Hero/Product Detail**: Large product image, gallery, title, rating, price, description, color selection.
  - **Actions**: "Chatear para Comprar" (Primary), "Preguntar al Asistente" (Secondary).
  - **Details**: Expandable sections for Description, Specs, Reviews.
### 1. Database Schema
#### [MODIFY] `schema.sql` (and execute migration)
- **Customers**: Create `customers` table (CRM foundation).
- **Carts**: Create `carts` table (Abandoned cart tracking).
- **Orders**: Link to `chat_id` and `customer_id`.
- **Messages**: Add `metadata` column (for Product Cards).
- **Categories**: Create `categories` table.

### 2. Dashboard Settings (`/dashboard/settings`)
#### [MODIFY] `src/app/dashboard/settings/components/organization-form.tsx`
- Refactor into tabs: "General", "Pagos", "Envíos", "Apariencia".
- **Apariencia**: Upload Logo (saves to `organizations.logo_url`) and Primary Color.

### 3. Storefront Home (`/store/[slug]`)
#### [NEW] `src/app/store/[slug]/page.tsx`
- **Design Base**: `Stitch Conversational E-Commerce (6)` prototype.
- **Customizations**:
  - **Hero**: Chat Mockup animation instead of static image. Headline: "Sin buscar, sin filtros, solo conversación."
  - **How it Works**: 3 steps visual (Tell us -> Recommendations -> Buy in chat).
  - **Products**: Limit to 4-6. Add "Recomendado por IA" badge.
  - **Social Proof**: Metrics (Time to buy: 3m, 95% satisfaction) instead of Testimonials.
  - **Footer**: Updated year 2025.

### 4. Checkout Logic (`/chat/[slug]`)
#### [NEW] `src/app/chat/components/checkout-modal.tsx`
- Modal for "Ir a Pagar".
- Collects user info (creates/updates `customers` record).
- Shows order summary.
- Payment selection (Wompi/Manual).
- Creates order in DB linked to `chat_id` and `customer_id`.
  - **Refined Plan**:
    - `/store/[slug]`: Lists products (Grid).
    - `/store/[slug]/p/[productId]`: Product Detail (The Prototype).
    - **Header**: Shared component.

### 3. Components
- `src/components/store/store-header.tsx`: Branded header.
- `src/components/store/product-card.tsx`: For the grid.
- `src/components/store/product-detail.tsx`: The full prototype implementation.

## Step-by-Step
1.  Create `src/app/store/[slug]/layout.tsx` (optional, or just use page).
2.  Create `src/app/store/[slug]/page.tsx` (Listing).
3.  Create `src/app/store/[slug]/p/[productId]/page.tsx` (Detail - The Prototype).
4.  Link "Chatear para Comprar" to `/chat/[slug]?product=[id]`.

## Verification
1.  Visit `/store/demo-store`.
2.  See list of products.
3.  Click a product -> See Detail Page (Prototype Design).
4.  Click "Chatear" -> Goes to Chat.
