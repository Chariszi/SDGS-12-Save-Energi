ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Accounts created before verification existed keep working.
UPDATE users SET email_verified_at = now();

CREATE TABLE email_verification_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX email_verification_tokens_user_idx ON email_verification_tokens (user_id);
CREATE INDEX email_verification_tokens_expiry_idx ON email_verification_tokens (expires_at);
