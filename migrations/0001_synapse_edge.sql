CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('webhook', 'runtime')),
  expires_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON idempotency_keys (expires_at_ms);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  shop TEXT NOT NULL,
  topic TEXT NOT NULL,
  webhook_id TEXT,
  path TEXT NOT NULL,
  status TEXT NOT NULL,
  order_ref TEXT,
  event_id TEXT,
  transaction_id TEXT,
  payload_json TEXT NOT NULL,
  normalized_payload_json TEXT,
  error_message TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_receipts_received
  ON webhook_receipts (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_receipts_shop_topic
  ON webhook_receipts (shop, topic);
CREATE INDEX IF NOT EXISTS idx_webhook_receipts_status
  ON webhook_receipts (status);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('synapse', 'elevar')),
  compare_key TEXT NOT NULL,
  event_name TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  value_cents INTEGER,
  currency TEXT,
  item_count INTEGER NOT NULL,
  items_fingerprint TEXT NOT NULL,
  event_id TEXT,
  observed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE (source, compare_key)
);

CREATE INDEX IF NOT EXISTS idx_observations_key
  ON observations (compare_key);
CREATE INDEX IF NOT EXISTS idx_observations_observed
  ON observations (observed_at DESC);

CREATE TABLE IF NOT EXISTS channel_events (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  surface TEXT NOT NULL,
  destination TEXT NOT NULL,
  pixel_id TEXT,
  event_name TEXT NOT NULL,
  transaction_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_message TEXT,
  observed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_events_observed
  ON channel_events (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_events_integration
  ON channel_events (channel, surface, destination, pixel_id);

CREATE TABLE IF NOT EXISTS dead_letters (
  id TEXT PRIMARY KEY,
  recorded_at TEXT NOT NULL,
  attempt INTEGER,
  http_status INTEGER,
  error_message TEXT NOT NULL,
  event_name TEXT,
  event_id TEXT,
  transaction_id TEXT,
  payload_json TEXT NOT NULL,
  replay_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (replay_status IN ('pending', 'replayed', 'failed')),
  replayed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dead_letters_pending
  ON dead_letters (replay_status, recorded_at DESC);

CREATE TABLE IF NOT EXISTS runtime_telemetry (
  id TEXT PRIMARY KEY,
  recorded_at TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_id TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('forwarded', 'suppressed', 'duplicate', 'accepted')),
  reason TEXT,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_recorded
  ON runtime_telemetry (recorded_at DESC);
