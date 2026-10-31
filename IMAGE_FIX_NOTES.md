# Image Storage Architecture Notes

## Bucket Allocation
- **`diagrams` Bucket (Public: ON)**:
  - All extracted question diagrams and option-level diagram images (`diagrams/...`) are uploaded here.
  - Image URLs are generated using `storage.from(DIAGRAM_BUCKET).getPublicUrl(fileName)`.
  - Configured via `DIAGRAM_BUCKET = process.env.DIAGRAM_BUCKET || 'diagrams'` in `backend/config/supabase.js`.
  - Used in:
    - `backend/workers/imageProcessor.js`
    - `backend/controllers/directExtractController.js`
    - `backend/controllers/libraryAdminController.js`

- **`uploads` Bucket (Private / Signed Access)**:
  - Holds uploaded PDF source documents only (`pdfs/...`).
  - Access is granted via time-limited signed URLs (`createSignedUrl`).
