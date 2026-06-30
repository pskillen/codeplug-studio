export default function BuildFooter() {
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '1rem 2rem',
        fontSize: '0.85rem',
        color: '#666',
        borderTop: '1px solid #eee',
      }}
    >
      Codeplug Studio · {__BUILD_ENV__} · {__BUILD_VERSION__}
    </footer>
  );
}
