import JsonView from '@uiw/react-json-view';
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';
import { Button, Group, Paper, ScrollArea, Stack } from '@mantine/core';
import { useState } from 'react';

export const JSON_TREE_DEFAULT_COLLAPSED_DEPTH = 5;

export interface JsonTreeViewerProps {
  value: unknown;
}

function toJsonViewValue(data: unknown): object {
  if (data !== null && typeof data === 'object') {
    return data as object;
  }
  return { value: data };
}

export default function JsonTreeViewer({ value }: JsonTreeViewerProps) {
  const [collapsed, setCollapsed] = useState<boolean | number>(JSON_TREE_DEFAULT_COLLAPSED_DEPTH);
  const [viewKey, setViewKey] = useState(0);

  const resetView = (nextCollapsed: boolean | number) => {
    setCollapsed(nextCollapsed);
    setViewKey((current) => current + 1);
  };

  return (
    <Stack gap="sm">
      <Group>
        <Button variant="default" size="compact-sm" onClick={() => resetView(false)}>
          Expand all
        </Button>
        <Button
          variant="default"
          size="compact-sm"
          onClick={() => resetView(JSON_TREE_DEFAULT_COLLAPSED_DEPTH)}
        >
          Collapse to default
        </Button>
      </Group>
      <Paper withBorder p="md">
        <ScrollArea.Autosize mah="70vh" type="auto">
          <JsonView
            key={viewKey}
            value={toJsonViewValue(value)}
            style={githubDarkTheme}
            collapsed={collapsed}
            displayDataTypes={false}
          />
        </ScrollArea.Autosize>
      </Paper>
    </Stack>
  );
}
