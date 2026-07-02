import type { SingleFileProjectImportAdapter } from '../../importAdapter.ts';
import type { SingleFileProjectExportAdapter } from '../../exportAdapter.ts';
import { parseProjectDocument } from './parse.ts';
import { serialiseProject } from './serialise.ts';

export const nativeYamlImportAdapter = {
  id: 'native-yaml',
  label: 'Native YAML',
  status: 'shipped',
  capabilities: {
    delivery: 'single-file',
    entityKinds: [],
  },
  parseDocument(text: string) {
    const project = parseProjectDocument(text);
    return { project, warnings: [] };
  },
} satisfies SingleFileProjectImportAdapter;

export const nativeYamlExportAdapter = {
  id: 'native-yaml',
  label: 'Native YAML',
  status: 'shipped',
  delivery: 'single-file',
  defaultFileName: 'project.yaml',
  serialise(aggregate) {
    return { content: serialiseProject(aggregate), warnings: [] };
  },
} satisfies SingleFileProjectExportAdapter;
