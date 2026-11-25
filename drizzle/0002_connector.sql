CREATE TABLE oauth_clients (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, redirect_uris TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE oauth_codes (hash TEXT PRIMARY KEY NOT NULL, client_id TEXT NOT NULL, visitor TEXT NOT NULL, redirect_uri TEXT NOT NULL, challenge TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE oauth_tokens (hash TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, client_id TEXT NOT NULL, visitor TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX oauth_tokens_visitor ON oauth_tokens(visitor);
