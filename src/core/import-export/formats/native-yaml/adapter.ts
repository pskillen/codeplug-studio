import type { SingleFileProjectImportAdapter } from '../../importAdapter.ts';
import type { SingleFileProjectExportAdapter } from '../../exportAdapter.ts';
import { collectAprsValidationWarnings } from '@core/domain/aprs/validation.ts';
import { documentFromAggregate } from '../../projectDocument.ts';
import { parseProjectDocumentWithWarnings } from './parse.ts';
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
    const { aggregate: project, warnings: buildWarnings } = parseProjectDocumentWithWarnings(text);
    const aprsWarnings = collectAprsValidationWarnings(documentFromAggregate(project).library).map(
      (warning) => warning.message,
    );
    return { project, warnings: [...buildWarnings, ...aprsWarnings] };
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
