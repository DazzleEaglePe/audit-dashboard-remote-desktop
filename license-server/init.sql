CREATE TABLE IF NOT EXISTS activation_keys (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  max_servers INTEGER NOT NULL,
  plan TEXT DEFAULT 'standard',
  features TEXT,                          -- CSV: "alerts,logs,screenshots"
  expires_days INTEGER NOT NULL DEFAULT 365,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'revoked'
  used_by_install_id TEXT,
  max_activations INTEGER NOT NULL DEFAULT 1,
  activation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issued_licenses (
  id SERIAL PRIMARY KEY,
  license_id TEXT NOT NULL UNIQUE,
  activation_key_id INTEGER NOT NULL REFERENCES activation_keys(id) ON DELETE CASCADE,
  install_id TEXT NOT NULL,
  payload TEXT NOT NULL,                  -- base64
  signature TEXT NOT NULL,                -- base64
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'revoked'
  issued_at TIMESTAMPTZ DEFAULT now()
);
