# ZZWS file layout

- `index.html`: page markup and external-library loading.
- `styles.css`: the original page styles.
- `js/core.js`: shared state and common helpers.
- `js/auth-data.js`: authorization, price-file loading and product parsing.
- `js/catalog.js`: filters, catalog rendering and product actions.
- `js/order-state.js`: cart, order modal and order history.
- `js/bulk-add.js`: bulk add by exact article code or partial model-name match.
- `js/order-submit.js`: order export, email/Viber text and final page event handlers.

The JavaScript files are classic scripts loaded synchronously in their listed order. This preserves the shared global functions used by existing inline HTML handlers. Keep that order unless the code is intentionally migrated to modules.
