-- Add customer_id to chats table to link conversations with customers
ALTER TABLE chats ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);
