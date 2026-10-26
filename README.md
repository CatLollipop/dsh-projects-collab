# dsh-projects-collab

A DSH `0.2.1-rc.2` bundle for local Projects and Shared Projects/group-chat collaboration.

## Included

- Host-side durable JSON persistence under `$DSH_HOME/projects-collab.json` (or `~/.dsh/projects-collab.json`): projects, members, chats, messages, invites, and audit records.
- Authenticated `/api/projects-collab` RPC with bounded methods: list/create project, list/create chat, append message, list/add member, and audit.
- Input validation, idempotency keys for writes, role checks (`owner`/`admin`/`member`/`viewer`), and bounded audit history.
- Client Settings → Projects 协作 page using `ctx.connection.rpc`, slots, locale dictionaries, and `--dsw-alias-*` theme tokens. It includes empty/loading/error/permission states, project list/detail, Chats/Members/Sources/Artifacts summaries, and message sending.

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

The test exercises RPC validation and idempotent service operations. If screenshots or browser automation are unavailable, UI rendering, slot visibility, and light/dark visual fidelity remain unverified; this bundle intentionally does **not** create mock screenshots. Verify Settings → Projects 协作 in a connected DSH Web page after installation.

## 验证状态（DSH 0.2.1-rc.2）

- Host bundle 已在当前 profile 中 `application: applied`，`fiberPhase: active`。
- Client 已注册到实时插槽：`sidebar.panellist`（面板图标）与 `main`（面板主体）的 occupants 中可见本插件 id。
- Client 只使用 `--dsw-alias-*` 主题 token、`ctx.connection.rpc`、`ctx.slots`、`ctx.locale`，不写 DOM、不导入 DSH Client 包。
- 单元测试与 `node --check` 通过（见下表）。

### 关于界面截图

本机在编写本文件时处于锁屏/无图形会话状态，`screencapture` 只能得到锁屏画面，因此仓库中**没有伪造的截图或 mock 图**。解锁 DSH 后可在实际界面中截图并按下面步骤替换本节：

1. 打开左侧栏对应的面板图标；
2. 浅色与深色主题各截一张，窗口宽度分别取 1280px 与 375px；
3. 将图片放到 `docs/screenshots/` 并在本文件引用。

面板内容：项目列表、项目概览（Chats / Members / Sources / Artifacts）、新建项目、新建 Chat、发送消息、添加成员、审计条数。
