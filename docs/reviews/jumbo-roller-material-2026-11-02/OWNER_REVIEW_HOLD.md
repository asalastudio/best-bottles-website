# Rejected 50 ml body and subsequent correction

After approving the roller material, the owner rejected the bottle shown in the local 50 ml review: “That is nit the correct bottle.” The component-material approval does not approve the body or assembled product.

The rejected review used the recovered `cylinder-50ml-16mm` body, SHA-256 `583b5d7a43ef7242dff43910ff81cc1d37c4cf1fb31877b83cead5f38b1f575c`, with selected recipe `GBCyl50MtlRollWht`. The owner clarified that the 50 ml body itself was incorrect and supplied separate 50 ml and 28 ml reference pages. The complete 50 ml PSD includes glass-neck pixels in retouch layers that the isolated body layer omits. The subsequent correction restores that wider neck and registers generated studio material inside its source contour. The 28 ml runtime body remains unchanged.

Current complete-source comparison: http://localhost:3010/reviews/jumbo50-body-reference-2026-11-02/index.html?sku=GBCyl50MtlRollWht

The earlier 48 passing browser states and zero-difference outline check remain technical checks of the roller, registration and rendering. They do not establish that the bottle body was accepted. The corrected 50 ml candidate has its own registration evidence and 48-state browser pass under `jumbo-body-reference-2026-11-02`. Candidate code and evidence are being saved to the draft PR, with source images archived separately in Drive. Body approval and production publication remain pending. The approved roller remains a separate reusable component. Existing sources are preserved.
