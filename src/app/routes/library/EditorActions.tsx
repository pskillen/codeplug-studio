import { Link } from 'react-router-dom';
import { primaryButtonStyle, secondaryButtonStyle } from '../../components/fields/styles.ts';

export default function EditorActions({
  saving,
  error,
  onSave,
  cancelPath = '/library/channels',
  hideCancel = false,
}: {
  saving: boolean;
  error: string | null;
  onSave: () => void;
  cancelPath?: string;
  hideCancel?: boolean;
}) {
  return (
    <div style={{ marginTop: '1rem' }}>
      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {hideCancel ? null : (
          <Link to={cancelPath} style={secondaryButtonStyle}>
            Cancel
          </Link>
        )}
      </div>
    </div>
  );
}
