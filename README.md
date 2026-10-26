# dsh-projects-collab

A DSH `0.2.1-rc.2` bundle for local Projects and Shared Projects/group-chat collaboration.

## Included

- Host-side durable JSON persistence under `$DSH_HOME/projects-collab.json` (or `~/.dsh/projects-collab.json`): projects, members, chats, messages, invites, and audit records.
- Authenticated `/api/projects-collab` RPC with bounded methods: list/create project, list/create chat, append message, list/add member, and audit.
- Input validation, idempotency keys for writes, role checks (`owner`/`admin`/`member`/`viewer`), and bounded audit history.
- Client Settings → Projects collaboration page using `ctx.connection.rpc`, slots, locale dictionaries, and `--dsw-alias-*` theme tokens. It includes empty/loading/error/permission states, project list/detail, Chats/Members/Sources/Artifacts summaries, and message sending.

## Install

Install the directory as a local bundle with the DSH plugin manager (the directory itself is the bundle target). Do not install dependencies; all runtime imports are Node built-ins or DSH-provided modules.

```sh
# from the workspace root, use the host plugin manager's install_bundle action
# target: ./dsh-projects-collab
```

## Verification

Run the minimal logic test without installing dependencies:

```sh
node --test dsh-projects-collab/test/rpc.test.js
node --check dsh-projects-collab/index.js
node --check dsh-projects-collab/client.js
```

The test exercises RPC validation and idempotent service operations. If screenshots or browser automation are unavailable, UI rendering, slot visibility, and light/dark visual fidelity remain unverified; this bundle intentionally does **not** create mock screenshots. Verify Settings → Projects collaboration in a connected DSH Web page after installation.
