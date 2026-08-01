-- Password authentication: optional password hash for users who
-- sign in with email + password instead of Google/GitHub OAuth.
ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE INDEX idx_users_email_password ON users(email) WHERE password_hash IS NOT NULL;
