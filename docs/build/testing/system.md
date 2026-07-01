# System tests

**Status: planned** — no `src/test/system/` directory yet. No `npm run test:system` script in `package.json`.

**Purpose:** Multi-step workflows **after** the import adapter boundary — `importIntoLibrary`, merge/replace policies, `assemble(build, library)`, `exportBuild`, IndexedDB persistence, multi-project isolation. Raw parser rows belong in [unit.md](unit.md); browser UI belongs in [component.md](component.md) and [e2e.md](e2e.md).

## Target command

```bash
npm run test:system   # planned
```

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

## Scenario matrix (to implement)

| Scenario                       | Proves                                      |
| ------------------------------ | ------------------------------------------- |
| Import into empty library      | Entities + warnings                         |
| Import merge vs replace        | Operator policy honoured                    |
| CRUD between import and export | User edits appear on wire                   |
| Multi-project isolation        | Library A not visible in project B          |
| Persistence reload             | IndexedDB schema migration + data integrity |

## Code anchors (planned)

- `src/core/services/importIntoLibrary.ts`
- `src/core/services/assemble.ts`
- `src/core/services/exportBuild.ts`
- `src/integrations/persistence/`

## Related

- [Testing hub](README.md)
- [Mapping tests](mapping-tests.md)
- [Unit tests](unit.md)
