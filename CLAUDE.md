# CLAUDE.md

Đọc `CODEMAP.md` trước khi tìm hoặc sửa code — nó chỉ ra hàm, action, API và số dòng gần đúng.

- `index.html` rất lớn, dòng dài: tìm bằng grep theo tên hàm/action rồi đọc đoạn nhỏ, không đọc cả file.
- `index.html` và `Sổ lớp.html` phải giống hệt nhau: sửa `index.html` rồi copy sang `Sổ lớp.html`.
- Bỏ qua `uploads/`, `data/logs/`, `data/report-submissions/` khi tìm kiếm.
- Kiểm thử: `node tests/<tên>.cjs` (danh sách trong CODEMAP.md §6).
