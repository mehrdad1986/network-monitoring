---
status: frozen
classification: feature
---
# Local monitoring targets repair
## Root causes
The active local launcher has no PostgreSQL store; list/create/detail cannot execute. Frontend sends type while backend expects target_type, and detail assumes a status field absent from the backend model. Target links previously omitted /app.
## Design and acceptance
- Local launcher opts into a bounded JSON target repository. Full PostgreSQL server remains on its existing store.
- Version 1 file: version and targets array of existing models.Target records. UUID, created_at, updated_at, enabled fields populated. Name/address/type/port validated; max 1000 records, 2 MiB file, 8 KiB request. No credentials or authentication data stored.
- Mutex-protected updates use temp file, fsync and atomic rename in the same directory. Failed writes do not publish in-memory state. Corrupt/incompatible state fails startup without overwriting data. No seeded sample records.
- List, create and detail work, with duplicate endpoint checks and stable UUIDs. Data survives reload/restart. Missing IDs return 404; invalid input 400; duplicate 409; persistence error 500.
- Frontend maps target_type and absent status to unknown; uses /app/targets routes. Creation errors remain inline without losing form input. Labels and bounded inputs support keyboard/testing.
- Detail explicitly distinguishes a saved target from a monitored target; no invented health or history. Scheduled measurements remain dependent on full monitoring backend.
## Verification
Real local API tests cover persistence, invalid data, corruption, duplicates, concurrent writes and failed writes. React tests cover create/retry/detail normalization. Browser test creates one synthetic loopback target, opens detail and checks persistence after backend restart.
## Rollback
Revert only these changes, retain target state file and any temp files for recovery; never delete user target inventory. PostgreSQL schema unchanged.
