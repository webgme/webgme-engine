# Exchange format v2 — repository export

This document describes the v2 project exchange format introduced on the `historyio` branch. It complements the existing v1 snapshot format produced by `getProjectJson`.

## Motivation

The v1 format exports only the **object closure reachable from a single branch, commit, tag, or root**. That is sufficient for seeding and model transfer, but it drops:

- Other branches and their commits
- Tags not on the exported head
- Unreachable objects still present in storage (old commits, abandoned data)

v2 exports the **full project repository**: all stored objects plus explicit branch, tag, and commit listings.

## API

| Function | Purpose |
|----------|---------|
| `getProjectWithHistory(project, parameters)` | Export full repository to JSON |
| `insertProjectWithHistory(project, projectJson)` | Import a v2 repository dump |

Both live in `src/common/storage/util.js` alongside `getProjectJson` / `insertProjectJson`.

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
    "objects": ["#first", "#abc123", "#def789", "#root456"],
    "assets": []
  },

  "objects": [
    { "_id": "#root456", "type": "..." },
    { "_id": "#first", "type": "commit", "time": 1710000000000, "root": "#root456", "parents": ["#initial"] },
    { "_id": "#abc123", "type": "commit", "time": 1710000001000, "root": "#root456", "parents": ["#first"] }
  ]
}
```

### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `formatVersion` | yes | Must be `2` for v2 import |
| `exportMode` | yes | Must be `"repository"` |
| `projectId` | yes | Project identifier (`owner+name`) |
| `kind` | yes | Project kind string |
| `branchName` | no | Default branch used for v1 compatibility |
| `commitHash` | no | Head commit of default branch (v1 compat) |
| `rootHash` | no | Root object of default branch head (v1 compat) |
| `branches` | yes | Map of branch name → commit hash |
| `tags` | yes | Map of tag name → commit hash |
| `commits` | yes | Commit objects sorted by ascending `time` (convenience listing) |
| `hashes.objects` | yes | All exported object ids |
| `hashes.assets` | yes | Blob hashes referenced from exported objects |
| `objects` | yes | All repository objects except branch/tag index records |

### What is excluded from `objects`

Records stored only as storage indices are omitted because they are represented in `branches` / `tags`:

- Mongo branch documents (`_id` matching `*branchName`)
- The `TAGS` document
- The `empty` project marker
- In-memory branch pointer records (matched by branch name)

Commit objects **are included** in `objects` and duplicated in `commits` for convenience.

## Backward compatibility

### Export

`getProjectWithHistory` always sets v1-compatible top-level fields from the default branch (`master` if present, otherwise the first branch). Older importers that call `insertProjectJson` and ignore unknown fields can still import the default snapshot if they only read v1 fields — though they will not restore full history.

### Import

| Input | Handler |
|-------|---------|
| v1 (`formatVersion` absent) | Use existing `insertProjectJson` |
| v2 (`formatVersion: 2`) | Use `insertProjectWithHistory` |

`insertProjectWithHistory`:

1. Inserts every object in `objects` via the database project adapter
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
