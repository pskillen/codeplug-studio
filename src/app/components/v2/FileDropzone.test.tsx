import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import FileDropzone from './FileDropzone.tsx';

function makeFile(name: string) {
  return new File(['content'], name, { type: 'text/plain' });
}

describe('FileDropzone', () => {
  it('calls onFilesSelected when a file is chosen via the hidden input', () => {
    const onFilesSelected = vi.fn();
    const { container } = render(
      <DesignSystemV2Provider>
        <FileDropzone onFilesSelected={onFilesSelected} />
      </DesignSystemV2Provider>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('project.yaml');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('calls onFilesSelected on drop', () => {
    const onFilesSelected = vi.fn();
    render(
      <DesignSystemV2Provider>
        <FileDropzone onFilesSelected={onFilesSelected} />
      </DesignSystemV2Provider>,
    );
    const file = makeFile('project.yaml');
    fireEvent.drop(screen.getByRole('button'), { dataTransfer: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('collapses to a selected-file row when fileName is set, and calls onClear', () => {
    const onClear = vi.fn();
    render(
      <DesignSystemV2Provider>
        <FileDropzone onFilesSelected={() => undefined} fileName="project.yaml" onClear={onClear} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('project.yaml')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /browse/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove file' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('renders the error message when provided', () => {
    render(
      <DesignSystemV2Provider>
        <FileDropzone onFilesSelected={() => undefined} error="Choose a .yaml or .yml file" />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Choose a .yaml or .yml file')).toBeInTheDocument();
  });
});
