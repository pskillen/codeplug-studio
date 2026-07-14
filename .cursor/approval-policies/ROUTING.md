- product: deploy-and-ci
  boundary: .github/workflows/**
  policies:
    - .github/workflows/APPROVAL_POLICY.md

- product: cursor-governance
  boundary: .cursor/approval-policies/**
  policies:
    - .cursor/approval-policies/APPROVAL_POLICY.md

- product: architecture-constitution
  boundary: .cursor/rules/**
  policies:
    - .cursor/rules/APPROVAL_POLICY.md
