# K02A02 Notebook

Trang tĩnh: `index.html` và `Sổ lớp.html` có nội dung giống nhau.

## Vercel GitHub API

Set these Vercel environment variables for Production (and Preview if used):

- GITHUB_TOKEN: a new fine-grained token with Contents: Read and write on the data repository.
- GITHUB_REPO: tranhodat/tcct2026
- GITHUB_BRANCH: main
- EDIT_PASSWORD: tcct2026

Redeploy after changing environment variables. The browser calls /api/github; only the server sends the GitHub token. The browser reads public repository settings from /api/github?action=config. config.js is no longer required. Tokens remain server-only.

Enable Edit mode before uploading or changing data. The password is kept in tab memory and sent over HTTPS to authorize API requests. Clear it by disabling Edit mode. Local static servers and GitHub Pages cannot run this API; use Vercel or vercel dev.

Documents and course attachments accept all file formats up to 50 MiB per file. Files up to 3 MiB use the existing upload endpoint. Larger files use /api/upload in 2 MiB chunks, stored as Git blobs with signed receipts valid for 24 hours. Finalization verifies receipts and the total size, assembles the file server-side, and writes one complete file to the existing repository. Tokens remain server-only; no additional environment variables are required. Interrupted uploads never create document records; retry the upload from the form. Unreferenced chunk blobs are left for GitHub garbage collection. Report submissions retain their separate 3 MiB limit.

Deploy api/upload.js, both HTML entrypoints, and vercel.json together; the new endpoint allows up to 300 seconds for finalization. Validation: node tests/upload.cjs (mock GitHub, including 50 MiB assembly), node tests/check.cjs, node tests/api.cjs, node tests/delete-upload.cjs. Production network uploads still require verification after deployment.

If push protection blocks an old commit, remove its token from every affected unpushed commit; changing the current file alone does not clear history. Revoke any token exposed publicly or shared in chat.

## Dùng trên GitHub Pages / Vercel

Đặt các tệp tại thư mục gốc website; dùng `index.html` làm trang chủ. Vercel dùng cấu hình tĩnh trong `vercel.json`. Khi repo chứa website cũng là repo dữ liệu, `data/solop-static.json` là bản dữ liệu chung sau khi triển khai. Nếu dùng repo lưu trữ riêng, khai báo `window.CLASS_CONFIG` through `config.js`. Do not publish a token in this file.

Trang đọc metadata từ repository đã chọn (hoặc `./data/solop-static.json`) khi khởi động nếu bản đó mới hơn dữ liệu cục bộ. Đây chưa phải cơ chế hợp nhất khi nhiều người chỉnh sửa cùng lúc. Repository công khai đồng nghĩa tệp tải lên cũng công khai.

## Kiểm tra

Chạy `node tests/check.cjs`. Kiểm thử gồm chức năng trang, xác thực mật khẩu, đường dẫn upload, ngưỡng dung lượng, lỗi API, metadata SHA và việc không lưu token. API được mô phỏng; không gửi tệp thật 3 MB hoặc commit vào repository thực.

## Device news and update notifications

The Tin mới tab supports multiple RSS/Atom sources or websites that advertise a feed. Sources, cached articles, and starred articles are stored only in browser localStorage on the current device. Nothing from this tab is committed to GitHub. Switch between Tin mới and Tin đã lưu and use the star to save or remove an article. Removing a source preserves starred articles. Existing single-source RSS settings migrate automatically.

Use Đọc tin mới to refresh manually. Automatic refresh runs every 15 minutes. Failed sources preserve their cache. The server discovers feeds advertised by websites and checks every redirect against public HTTPS address restrictions. Websites without RSS/Atom require a direct feed URL. Clearing browser data removes local settings and saved articles.

The bell before the view-mode label controls update notifications. Data is checked every minute and when returning to the page; polling pauses in Edit mode. Browser notifications require permission and run only while the page is open.

Checks: node tests/check.cjs, node tests/api.cjs, node tests/features.cjs, node tests/news.cjs, node tests/rss.cjs.

## Shared class feedback

Tabs are ordered: calendar, announcements, documents, courses, images, news, feedback. Announcements use native details/summary rows, collapsed until opened.

The feedback tab allows every reader to add comments with the plus button without Edit mode. GET/POST /api/comments reads/appends data/comments.json using the existing server-side GITHUB_TOKEN, GITHUB_REPO and GITHUB_BRANCH. No additional environment variables are required. The server validates names/text, fixes the write destination, preserves earlier comments and retries GitHub SHA conflicts. Names are self-reported; comments are shared with everyone. Only the last entered display name is remembered locally.

Limits: 80 characters per name, 20,000 characters per comment, 2,000 comments or 700 KiB total storage. The UI reports write errors and retains the submitted form for retry. Use the refresh button to load other readers' comments. Additional test: node tests/comments.cjs.

New comments carry an owner credential generated and stored in the posting browser; only its SHA-256 hash is stored on the server and it is omitted from public API responses. Owners can edit or delete their comments from that browser. Other readers cannot edit or delete them. Edit mode can edit or delete any comment, including older comments without owner credentials. Existing comments cannot safely be assigned to an owner by display name. Clearing browser storage or switching devices loses owner editing access. Voting and editing preserve each other's fields through GitHub SHA conflict retries. Long comments show the first 200 Unicode characters in a collapsible preview. UI checks: node tests/comments-ui.cjs.

## Report rounds and audit trail

The N?p b?o c?o tab is placed before ? ki?n. Editors create or edit rounds with opening/closing times in UTC+7. Readers enter a name and student code and submit up to 30 files per submission (3 MiB each). The server validates the deadline, identifiers, formats and file sizes for every file. Uploads are sequential; retries within the same form keep the submission ID and skip successful files. Uploaded file content is deduplicated by SHA-256. Round metadata and submissions use separate GitHub JSON files with SHA conflict retries, so general class-data saves cannot overwrite submissions. Names are self-reported and submitted files are visible to the class/public repository.

Storage: data/report-rounds.json, data/report-submissions/<round>.json, uploads/bao-cao/<round>/<submission>/, and data/logs/<UTC+7-day>/<timestamp>-<event-id>.json.

Editors open Nh?t k? h? th?ng from the Edit mode toolbar and select a day to view the newest 50 entries. The server records class metadata writes, uploads, comments, report-round changes and submitted files from this version onward. Each audit event uses a separate file to avoid lost log entries from concurrent actions. Events contain IDs, server times, actor labels, file paths and GitHub commit IDs where available, and never include tokens, passwords or file bodies. This is an application audit trail, not tamper-proof storage against repository administrators. Public repositories also expose these stored files.

If an action succeeds but its GitHub audit write fails, its response marks X-Audit-Status: failed, the UI displays a warning and the server writes a structured AUDIT_PERSIST_FAILED event to Vercel Logs. No new environment variables are required. Deploy api/reports.js, api/logs.js and lib/github-store.js with the updated site. Additional checks: node tests/reports.cjs and node tests/reports-ui.cjs.

## Class roster

The final Danh s?ch l?p tab reads data/class-roster.json, imported from the CHIA T? sheet of DANH SACH CHIA TO.xlsx: 29 members (15 in group 1, 14 in group 2). Columns preserve the workbook: sequence number, full name, birth date, position/workplace, phone and notes. Split name cells are joined; Excel serial birth dates are formatted as dd/mm/yyyy. Phone values with nine digits and no initial zero have been prefixed with 0; existing formatting is otherwise preserved.

The view includes group filters, accent-insensitive search across all columns, role badges, a sticky table header and horizontal scrolling on small screens. The roster is independent of class metadata saves. Deploy the JSON file with both HTML entrypoints. Validation: node tests/roster.cjs.

## Shared data synchronization

The browser now reads shared metadata through GET /api/state, which reads the configured GitHub repository on the server with Cache-Control: no-store. It uses the GitHub file SHA as a revision instead of comparing browser timestamps or reading raw.githubusercontent.com metadata. PUT /api/state requires the Edit mode password and the last confirmed revision; concurrent changes return 409 rather than overwriting another device. Server time supplies updatedAt. General metadata is restricted to 700 KiB.

Refresh runs on startup, every minute in view mode, when returning to the page, and through the manual sync button. The active report/comment view is refreshed too. Failed writes keep a pending browser snapshot and show the actual error. Old browser data is backed up before authoritative shared data is applied.

To publish old local-only documents/attachments: deploy the updated APIs and HTML, open the device that still contains those entries, enable Edit mode, and select the recovery button. Review the proposed additions and confirm. Recovery adds missing records and nested attachments without replacing existing shared records; old deleted entries may also appear in the review, so verify the list. After saving, other devices can refresh through the sync button. RSS sources and saved news remain device-local by design. Tests: node tests/sync.cjs.
