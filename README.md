# Golden Maple Landscaping production website

This repository powers [goldenmaplelandscaping.ca](https://goldenmaplelandscaping.ca), the production website for Golden Maple Landscaping in Barrie and Simcoe County, Ontario.

## Production workflow

- `main` is the production branch.
- Pushes to `main` run the existing GitHub Actions deployment workflow.
- Netlify builds the React Router application with the command defined in `netlify.toml` and publishes `build/client`.
- The production workflow deploys only to the Netlify site pinned in `.github/workflows/netlify-deploy.yml`.

## Local development

Prerequisites: Node.js 22 and npm.

```bash
npm ci --legacy-peer-deps
npm run dev
```

Run the same validation gates used by production before proposing a change:

```bash
npm run lint
npm run build
```

## Publication controls

Public business details are centralized in `src/data/business.ts`. Unresolved or conflicting claims are tracked in `BUSINESS_FACTS_REQUIRING_CONFIRMATION.md`. Do not introduce new prices, warranties, credentials, review claims, project claims, service areas or customer statements without traceable approval and evidence.
