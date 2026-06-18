# Exchange format v2 — repository export

This document describes the v2 project exchange format introduced on the `historyio` branch. It complements the existing v1 snapshot format produced by `getProjectJson`.

## Motivation

The v1 format exports only the **object closure reachable from a single branch, commit, tag, or root**. That is sufficient for seeding and model transfer, but it drops:

- Other branches and their commits
- Tags not on the exported head
- Unreachable objects still present in storage (old commits, abandoned data)

v2 exports the **full project repository**: core objects, all commits, branches, and tags — using the same raw-storage read path as `duplicateProject`, normalized into JSON.

## Storage adapter: `dumpProject`

Each database adapter implements `dumpProject()` on the opened project. It reads **all raw storage** and returns a classified structure:

```javascript
{
  objects: [ /* core / patch / shard records — no commits */ ],
  commits: [ /* commit objects, sorted by time */ ],
  branches: { master: '#...', feature: '#...' },
  tags: { 'release-1': '#...' }
}
```

| Backend | Raw read (same idea as copy) |
|---------|------------------------------|
| Mongo | `collection.find({})`, classify each document |
| Redis | `HGETALL` object hash + branch/tag maps |
| Memory | scan prefixed keys, classify each entry |

`getProjectWithHistory` calls `dumpProject` and wraps the result in the exchange JSON. No graph walk, no `traverse` in the export path.

## API

| Function | Purpose |
|----------|---------|
| `getProjectWithHistory(project, parameters)` | Export full repository to JSON |
| `insertProjectWithHistory(project, projectJson)` | Import a v2 repository dump (full history) |
| `insertProjectJson(project, projectJson, options)` | Import a snapshot; **auto-detects v2** and imports only the default-branch snapshot |

Both export/import pairs live in `src/common/storage/util.js` alongside `getProjectJson`.

Package layout (`.webgmex` zip with `project.json`) is unchanged; only the JSON schema differs when v2 fields are present.

## Format version

| Field | Value |
|-------|-------|
| `formatVersion` | `2` |
| `exportMode` | `"repository"` |

v1 exports omit both fields. Importers that only understand v1 continue to use top-level `branchName`, `commitHash`, `rootHash`, and `objects`.

## JSON schema

```json
{
  "formatVersion": 2,
  "exportMode": "repository",

  "projectId": "guest+MyProject",
  "kind": "exampleKind",

  "branchName": "master",
  "commitHash": "#abc123",
  "rootHash": "#root456",

  "branches": {
    "master": "#abc123",
    "feature": "#def789"
  },

  "tags": {
    "release-1": "#abc123"
  },

  "commits": [
    {
      "_id": "#first",
      "type": "commit",
      "time": 1710000000000,
      "root": "#root456",
      "parents": ["#initial"],
      "message": "initial import",
      "updater": ["guest"]
    },
    {
      "_id": "#abc123",
      "type": "commit",
      "time": 1710000001000,
      "root": "#root456",
      "parents": ["#first"],
      "message": "commit on master",
      "updater": ["guest"]
    }
  ],

  "hashes": {
    "objects": ["#abc123", "#def789", "#root456"],
    "assets": []
  },

  "objects": [
    { "_id": "#root456", "type": "..." }
  ]
}
```

Commit objects appear **only** in `commits`, not in `objects`. `hashes.objects` lists ids from both arrays.

### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `formatVersion` | yes | Must be `2` for v2 full import |
| `exportMode` | yes | Must be `"repository"` |
| `projectId` | yes | Project identifier (`owner+name`) |
| `kind` | yes | Project kind string |
| `branchName` | no | Default branch used for v1 compatibility |
| `commitHash` | no | Head commit of default branch (v1 compat) |
| `rootHash` | no | Root object of default branch head (v1 compat) |
| `branches` | yes | Map of branch name → commit hash |
| `tags` | yes | Map of tag name → commit hash |
| `commits` | yes | Commit objects sorted by ascending `time` |
| `hashes.objects` | yes | Ids from `objects` **and** `commits` |
| `hashes.assets` | yes | Blob hashes referenced from `objects` |
| `objects` | yes | Core / patch / shard records only (no commits, no branch/tag index records) |

### What is excluded from `objects`

Records stored only as storage indices:

- Mongo branch documents (`_id` matching `*branchName`)
- The `TAGS` document
- The `empty` project marker
- All commit objects (they live in `commits`)

## Backward compatibility

### Export

`getProjectWithHistory` always sets v1-compatible top-level fields (`branchName`, `commitHash`, `rootHash`) from the default branch (`master` if present, otherwise the first branch).

### Import

| Goal | Handler | Behaviour |
|------|---------|-----------|
| v1 snapshot | `insertProjectJson` | Unchanged for plain v1 JSON |
| v1 snapshot **from v2 file** | `insertProjectJson` | Detects `formatVersion: 2`, extracts object closure from `rootHash` / default branch, **ignores** other branches, tags, and commit history; creates one new commit |
| v2 full history | `insertProjectWithHistory` | Restores all `objects`, `commits`, `branches`, and `tags` |

#### v1 import from a v2 package

Older tooling that calls `insertProjectJson` (or the `import` bin) does **not** need a separate code path. When `formatVersion === 2`:

1. Read `rootHash` (or resolve it from `commitHash` via the `commits` list)
2. Walk the **object closure** from `rootHash` through `objects` only (same rules as `getProjectJson`)
3. Call `makeCommit` with that subset — one branch, no tags, no other branches

So a v2 `.webgmex` file is safe to hand to legacy import: you get the latest default-branch snapshot, not the full repository.

`insertProjectWithHistory`:

1. Inserts every record in `objects` and `commits`
2. Restores each branch with `setBranchHash(branch, '', commitHash)`
3. Restores each tag with `createTag(name, commitHash)`

It does **not** create a new commit; history is preserved as exported.

## Large projects (future)

For projects too large for a single JSON array, the same schema can be split into a zip bundle:

```
project.webgmex
  manifest.json     ← all fields except objects
  objects.jsonl     ← one object per line
  assets/           ← optional blob files
```

That streaming layout is not implemented yet; the current API returns a single in-memory JSON structure.

## Related work

- File-based SQLite storage plan: see `docs/filestorage-sqlite-plan.md` on the `filestorage` branch
- v1 snapshot export: `getProjectJson` in `src/common/storage/util.js`

## Testing

Integration tests in `test/common/storage/project.historyio.spec.js` use in-memory project storage but still require **MongoDB** for auth setup (`clearDBAndGetGMEAuth`). Start Mongo before running:

```bash
npm run test_ci -- --grep "Storage project history io"
```
