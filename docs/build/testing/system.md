# System tests

**Status:** first scenario shipped — native YAML full-project interchange ([#59](https://github.com/pskillen/codeplug-studio/issues/59)).

**Purpose:** Multi-step workflows **after** the import adapter boundary — `importProjectYaml`, merge/replace policies, `assemble(build, library)`, `exportBuild`, IndexedDB persistence, multi-project isolation. Raw parser rows belong in [unit.md](unit.md); browser UI belongs in [component.md](component.md) and [e2e.md](e2e.md).

## Command

```bash
npm run test:system
```

Runs `src/test/system/` only. Full matrix expansion remains planned.

## Workflow harness (planned)

Single entry point for production call order — reuse in new scenarios and future Playwright helpers:

| Symbol                         | Role                                    |
| ------------------------------ | --------------------------------------- |
| `runImportIntoLibraryWorkflow` | parse → preview → apply to library      |
| `runAssembleAndExport`         | library + build → wire files            |
| `runPersistAndReload`          | IndexedDB round-trip without corruption |

**Invariant assertions** (reuse across scenarios):

- Preview stats === apply report stats
- After apply, re-import unchanged CSV → idempotent (no duplicate entities)
- Zone `memberChannelIds` use UUID refs — wire names resolved only at export
- Build trait layout survives persist + reload

## Scenario matrix

| Scenario                       | Proves                                      | Status   |
| ------------------------------ | ------------------------------------------- | -------- |
| Native YAML export → replace   | Services + persistence + interchange meta   | Shipped  |
| Import into empty library      | Entities + warnings                         | Planned  |
| Import merge vs replace        | Operator policy honoured                    | Planned  |
| CRUD between import and export | User edits appear on wire                   | Planned  |
| Multi-project isolation        | Library A not visible in project B          | Planned  |
| Persistence reload             | IndexedDB schema migration + data integrity | Planned  |

## Code anchors

- `src/core/services/importProjectYaml.ts`
- `src/core/services/exportProjectYaml.ts`
- `src/core/services/projectInterchangePort.ts`
- `src/integrations/persistence/` — `loadProjectSeed`, `replaceProject`
- `src/test/system/nativeYamlInterchange.test.ts`

## Related

- [Testing hub](README.md)
- [Mapping tests](mapping-tests.md)
- [Unit tests](unit.md)
