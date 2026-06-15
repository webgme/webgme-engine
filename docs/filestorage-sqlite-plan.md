# File storage plan — SQLite per project

This document describes the proposed file-based storage backend for the `filestorage` branch. It targets **large, solo/local deployments** where an embedded database can outperform a remote MongoDB for project data.

Auth, users, and project metadata (`_users`, `_projects`) remain on MongoDB.

## Goals

- One project = one portable file on disk
- Full compatibility with the existing `DatabaseAdapter` contract (`test/server/storage/datastores/testgenerators.js`)
- Optimized for large graphs (many objects, long commit history)
- Same semantics as Mongo / Redis / Memory for branches, tags, commits, and core objects

## Non-goals (initial MVP)

- Multi-user concurrent write scaling (solo / single-process server first)
- Replacing MongoDB for auth or metadata
- Client-side (browser) storage — same on-disk format may be reused later

## On-disk layout

```
{dataDir}/
  guest+MyProject.webgme.db
  guest+Other.webgme.db
```

- `{dataDir}` comes from `config.storage.database.options.directory`
- Project ID `owner+name` is encoded in the filename (`+` → `%2B` or similar safe encoding)

## Library

**[`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3)** — single dependency, synchronous API, good local performance, transactional commits.

No ORM. Prepared statements only.

## Schema (per project file)

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE objects (
    _id   TEXT PRIMARY KEY NOT NULL,
    json  TEXT NOT NULL
);

CREATE TABLE branches (
    name         TEXT PRIMARY KEY NOT NULL,
    commit_hash  TEXT NOT NULL
);

CREATE TABLE tags (
    name         TEXT PRIMARY KEY NOT NULL,
    commit_hash  TEXT NOT NULL
);

CREATE INDEX idx_objects_commit_time ON objects (
    json_extract(json, '$.time')
) WHERE json_extract(json, '$.type') = 'commit';
```

### Mapping from current storage model

| WebGME record | SQLite location |
|---------------|-----------------|
| Core / patch / shard / commit objects | `objects` row (`_id` + canonical JSON) |
| Branch `*master` → `#commit` | `branches` row |
| Tags document (`TAGS`) | `tags` rows |
| `empty` marker | implicit — file exists ⇒ project exists |

Commit objects stay in `objects` like today. `getCommits(before, n)` uses the partial index on commit `time`.

## Adapter API mapping

| Method | Implementation |
|--------|----------------|
| `openDatabase` | Ensure `{dataDir}` exists; no global connection required |
| `closeDatabase` | Close any cached DB handles |
| `createProject` | Create empty DB with schema + default `TAGS`/branch state |
| `deleteProject` | Delete `.webgme.db` file |
| `openProject` | Open SQLite file read/write |
| `renameProject` | Rename file |
| `duplicateProject` | Copy file (or `VACUUM INTO`) |
| `loadObject` | `SELECT json FROM objects WHERE _id = ?` |
| `insertObject` | `INSERT OR …` with same hash-equality rules as Mongo/Memory |
| `getBranches` / `getBranchHash` / `setBranchHash` | `branches` table |
| `getTags` / `createTag` / `deleteTag` | `tags` table |
| `getCommits` | Indexed query on commit objects |
| `traverse` | `SELECT _id, json FROM objects` cursor, batch 1000 |

## Configuration sketch

```javascript
config.storage.database.type = 'file';
config.storage.database.options = {
    directory: './webgme-projects',
    busyTimeout: 5000
};
config.mongo.uri = 'mongodb://127.0.0.1:27017/webgme'; // auth + metadata only
```

Factory registration (planned):

```javascript
// config.storage.database.module optional override for third-party adapters
createDatabaseAdapter(logger, gmeConfig);
```

## Performance expectations vs Mongo (local / large project)

| Operation | Mongo (remote) | SQLite (local file) |
|-----------|----------------|---------------------|
| `loadObject` | Network + BSON | B-tree lookup |
| `makeCommit` (N objects) | N round-trips unless batched | Single transaction |
| `getCommits` | Collection scan / index | Indexed `time` lookup |
| `duplicateProject` | Server `$out` | File copy |
| Full history export | Collection cursor | Table scan → stream |

Mongo remains better for replicated multi-user server deployments. SQLite wins for **portable project files**, **offline solo use**, and **low-latency local editing**.

## Concurrency

- WAL mode + `busy_timeout`
- One write transaction per `makeCommit`
- Optional `proper-lockfile` on the project file if multiple processes may open the same project (rare in solo mode)

## Import / export integration

- **Snapshot export** — existing `getProjectJson` (unchanged)
- **Full history export** — `getProjectWithHistory` on the `historyio` branch (see `docs/exchange-format-v2.md`)
- Import of a repository dump maps directly onto `objects` + `branches` + `tags` tables via `insertProjectWithHistory`

## Implementation phases

1. **Plumbing** — `createDatabaseAdapter`, fix `index.js#getStorage` to respect config, document adapter interface
2. **SQLite adapter MVP** — pass `testgenerators.js` against memory/mongo parity tests
3. **Large-project tuning** — batch inserts, streaming traverse, export benchmarks
4. **Optional** — streaming `.webgmex` v2 zip with `objects.jsonl` for exports too large for one JSON array

## Testing strategy

- Reuse `test/server/storage/datastores/testgenerators.js` (full adapter contract)
- Round-trip `getProjectWithHistory` → `insertProjectWithHistory` on file adapter
- Performance fixture: import a large seed, compare commit latency vs Mongo on same machine

## Open questions

- Should project listing scan `{dataDir}` or continue to rely on Mongo `_projects` metadata? **Recommendation:** keep Mongo metadata for server mode; optional directory scan for standalone/file-only CLI.
- Filename encoding for exotic project IDs — use `%2B` for `+`, reject path separators.
