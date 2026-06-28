-- Klaviyo integration: support anonymous profiles without email

-- Make email nullable (Klaviyo profiles are anonymized — no PII required)
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;

-- Drop the old unique constraint that required email
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_brand_id_email_key;

-- Klaviyo-specific columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS klaviyo_id text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_consent text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS predicted_gender text;

-- Unique constraint for Klaviyo ID deduplication
ALTER TABLE customers ADD CONSTRAINT customers_brand_klaviyo_uniq
  UNIQUE (brand_id, klaviyo_id);

-- Partial unique index for email (only when email is present)
CREATE UNIQUE INDEX IF NOT EXISTS customers_brand_email_uniq
  ON customers(brand_id, email) WHERE email IS NOT NULL;
