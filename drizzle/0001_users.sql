CREATE TABLE personal_entries (visitor TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(visitor,id));
--> statement-breakpoint
CREATE TABLE original_owner (slot INTEGER PRIMARY KEY CHECK(slot=1), visitor TEXT NOT NULL);
