SET lock_timeout = '2s';
SET statement_timeout = '10s';

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS video_url TEXT;

RESET statement_timeout;
RESET lock_timeout;
