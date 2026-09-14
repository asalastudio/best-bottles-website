# Header wordmark — 2026-09-13

Added Jordan's supplied transparent PNG to the shared website header, mobile menu, and mobile builder. Source bytes are unchanged; CSS frames the visible lettering. Home links have an accessible label and at least a 44px target height.

Verified the homepage at 1440px, 1280px, 390px, and 320px, plus the 390px bottle builder: HTTP 200, loaded logo image, no browser runtime errors, no horizontal overflow, and unchanged header heights. The first sequential browser pass encountered a development-auth redirect loop; rerunning each viewport with a fresh browser context passed all five views. Authentication code was not changed.

Targeted ESLint passed with zero errors and one pre-existing unused startDictation warning in Navbar.tsx. Before/after screenshots use matching dimensions. See comparison.html, before.json, after.json, and asset-record.json. Local implementation only; no commit or deployment performed.
