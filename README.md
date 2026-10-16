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

Maximum file size is now 3 MiB because Vercel Functions limit request payloads to 4.5 MB and base64 adds overhead. Large-file uploads require a separate storage or multipart architecture.

If push protection blocks an old commit, remove its token from every affected unpushed commit; changing the current file alone does not clear history. Revoke any token exposed publicly or shared in chat.

## Dùng trên GitHub Pages / Vercel

Đặt các tệp tại thư mục gốc website; dùng `index.html` làm trang chủ. Vercel dùng cấu hình tĩnh trong `vercel.json`. Khi repo chứa website cũng là repo dữ liệu, `data/solop-static.json` là bản dữ liệu chung sau khi triển khai. Nếu dùng repo lưu trữ riêng, khai báo `window.CLASS_CONFIG` through `config.js`. Do not publish a token in this file.

Trang đọc metadata từ repository đã chọn (hoặc `./data/solop-static.json`) khi khởi động nếu bản đó mới hơn dữ liệu cục bộ. Đây chưa phải cơ chế hợp nhất khi nhiều người chỉnh sửa cùng lúc. Repository công khai đồng nghĩa tệp tải lên cũng công khai.

## Kiểm tra

Chạy `node tests/check.cjs`. Kiểm thử gồm chức năng trang, xác thực mật khẩu, đường dẫn upload, ngưỡng dung lượng, lỗi API, metadata SHA và việc không lưu token. API được mô phỏng; không gửi tệp thật 3 MB hoặc commit vào repository thực.

## Device news and update notifications

RSS settings and the last eight articles are stored only in browser localStorage. Use the RSS button to enter a direct public HTTPS feed. Refresh runs every 15 minutes; offline errors preserve cached articles. Clearing browser data removes these settings. The /api/rss function fetches at most 1 MiB and rejects private addresses and redirects.

When the page is open, shared data is checked every minute and when returning to the tab. New data displays an update banner; browser notifications require permission from the notification button. Polling pauses in Edit mode. Notifications do not run after the page is closed.

In Edit mode, document rows include Edit for name, folder, notes, and link URL when applicable. Original uploaded file paths are preserved. Course cards display the teacher or a missing-information label.

Additional checks: node tests/features.cjs and node tests/rss.cjs.
