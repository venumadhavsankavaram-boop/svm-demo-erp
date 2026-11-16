# erp-template

The generic school ERP that every new school starts from: Node/Express + **MySQL**, a modular browser app in `public/modules/`.
It is **synced from the Raghavan ERP** — do not edit `server.js`, `db.js` or `public/` here; change them in Raghavan, then run `node tools/sync-from-raghavan.mjs` from the repo root.

* Hosting: GoDaddy Node.js Hosting (the database and its `DB_*` secrets are created automatically).
* Database: tables are created on first start; the first start also prints a one-time `admin` password.
* Per-school branding and `manifest.json` are applied by `website-builder.html` when it builds the school's zip.
* `demo/` holds the sample-school loader used only for demo copies (`DEMO_MODE=true`). Never ship it to a real school.
* Owned by the template (not overwritten by sync): `package.json`, `LICENSE`, `.gitignore`, `public/manifest.json`, `public/sw.js`, icons.
