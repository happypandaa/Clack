var e=`CREATE TABLE IF NOT EXISTS clack_settings (
  key TEXT NOT NULL PRIMARY KEY CHECK (key IN ('uiLanguage', 'articleLanguage')),
  value TEXT NOT NULL CHECK (value IN ('zh', 'en'))
) STRICT;

CREATE TABLE IF NOT EXISTS clack_preferences (
  key TEXT NOT NULL PRIMARY KEY CHECK (key IN ('theme')),
  value TEXT NOT NULL CHECK (value IN ('ink', 'pine', 'tea'))
) STRICT;

CREATE TABLE IF NOT EXISTS clack_records (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 160),
  article_id TEXT NOT NULL CHECK (length(article_id) BETWEEN 1 AND 160),
  language TEXT NOT NULL CHECK (language IN ('zh', 'en')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  completed_at TEXT NOT NULL CHECK (length(completed_at) = 24 AND completed_at GLOB '????-??-??T??:??:??.???Z'),
  duration_ms REAL NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 1.7976931348623157e308),
  speed REAL NOT NULL CHECK (speed >= 0 AND speed <= 1.7976931348623157e308),
  accuracy REAL NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  correct_characters INTEGER NOT NULL CHECK (correct_characters BETWEEN 0 AND 9007199254740991),
  typed_characters INTEGER NOT NULL CHECK (typed_characters BETWEEN correct_characters AND 9007199254740991),
  total_characters INTEGER NOT NULL CHECK (total_characters BETWEEN typed_characters AND 9007199254740991)
) STRICT;

CREATE INDEX IF NOT EXISTS clack_records_language_completed_at
  ON clack_records (language, completed_at DESC);

CREATE TRIGGER IF NOT EXISTS clack_records_limit
BEFORE INSERT ON clack_records
WHEN NOT EXISTS (SELECT 1 FROM clack_records WHERE id = NEW.id)
  AND (SELECT COUNT(*) FROM clack_records) >= 10000
BEGIN
  SELECT RAISE(ABORT, 'Clack history is limited to 10000 records');
END;
`;export{e as default};