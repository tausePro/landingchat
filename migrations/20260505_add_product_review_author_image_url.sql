SET lock_timeout = '2s';
SET statement_timeout = '10s';

ALTER TABLE public.product_reviews
    ADD COLUMN IF NOT EXISTS author_image_url TEXT;

RESET statement_timeout;
RESET lock_timeout;
