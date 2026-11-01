# CODEMAP — K02A02 Notebook (Sổ lớp)

Bản đồ để AI (Claude/Codex) tìm đúng chỗ mà không phải đọc toàn bộ file.
Số dòng là **gần đúng** (snapshot 2026-11-01) — luôn tìm theo **tên hàm / tên action** bằng grep.

## 0. Quy tắc vàng (đọc trước)

- `index.html` và `Sổ lớp.html` **phải giống hệt nhau** (test kiểm tra). Sửa `index.html` rồi copy sang `Sổ lớp.html`.
- `index.html` ~157 KB, dòng rất dài (tới 1.500 ký tự). **Không đọc cả file.** Dùng `grep -n "tênHàm" index.html` rồi `sed -n 'A,Bp'` / Read với offset+limit.
- Không có build, không framework, không package.json. Frontend = 1 file HTML (CSS + JS inline). Backend = Vercel serverless `api/*.js` (CommonJS, `module.exports=(req,res)`).
- Dữ liệu lưu trên **GitHub repo** (chính repo này) qua GitHub Contents API, token chỉ ở server.
- Bỏ qua khi tìm kiếm: `uploads/` (tệp người dùng), `data/logs/` (audit log), `data/report-submissions/`.

## 1. Cây thư mục

```
index.html            # TOÀN BỘ frontend (CSS + JS)
Sổ lớp.html           # bản sao y hệt index.html
vercel.json           # static + api/upload.js maxDuration 300s
.env.example          # GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, EDIT_PASSWORD
api/
  state.js            # GET/PUT dữ liệu lớp chung (data/solop-static.json), SHA revision, 409 khi xung đột
  github.js           # ?action=config (cấu hình public); ?path= upload tệp ≤3 MiB; PUT metadata
  upload.js           # upload tệp lớn (≤50 MiB) theo chunk 2 MiB: action=chunk → finalize, receipt ký HMAC
  comments.js         # GET/POST data/comments.json; action add|edit|delete|vote; owner key hash SHA-256
  reports.js          # đợt nộp báo cáo + bài nộp: data/report-rounds.json, data/report-submissions/<round>.json, uploads/bao-cao/
  logs.js             # GET ?date= → đọc audit log data/logs/<ngày>/
  rss.js              # proxy RSS/Atom (chặn IP nội bộ, theo redirect, giải nén gzip/br)
lib/
  github-store.js     # dùng chung: settings, editor (check mật khẩu), request, read, update (retry SHA), audit
data/
  solop-static.json   # dữ liệu lớp: events, anns, folders, docs, courses, albums, cls, aiTools, updatedAt, settings
  class-roster.json   # danh sách lớp (29 học viên, 2 tổ)
  comments.json       # ý kiến
  report-rounds.json  # các đợt nộp báo cáo
  report-submissions/ # bài nộp theo đợt
  logs/YYYY-MM-DD/    # audit, mỗi sự kiện 1 file
uploads/  tai-lieu/  album/  bao-cao/   # tệp tải lên
tests/*.cjs           # chạy: node tests/<tên>.cjs (mock GitHub, không gọi mạng thật)
```

## 2. Bố cục `index.html`

| Dòng ~ | Nội dung |
|---|---|
| 1–4 | `<head>` + `<style>` cơ sở (`:root`, biến màu) |
| 8–392 | `<style>` chính (CSS theo từng tab: `.lec-*`, `.roster-*`, `.news-*`, `.report-*`, …) |
| 393–412 | Khung HTML: `header.hero` (`#clsName`, `#syncBtn`, `#recoverBtn`, chuông, nút Edit mode), `#tabs`, `#view`, `#modal`, `#lb` (lightbox), `#toast` |
| 413–1375 | `<script>` toàn bộ ứng dụng |

### 2.1 Bản đồ JS (theo thứ tự trong file)

| Dòng ~ | Khu vực | Hàm / đối tượng chính |
|---|---|---|
| 418–444 | Tiện ích | `verifyPassword`, `$`, `esc`, `iso`, `parse`, `addDays`, `longDate`, `shortDate`, `fmtSize`, `uid`, `clone`, `linkify`, `store` (localStorage tiền tố `solop.`), `slug` |
| 445–465 | GitHub/upload path | `uploadPath`, `githubSettings`, `contentUrl`, `auditNotice`, `githubRequest`, `lectureUploadContext`, `albumUploadContext` |
| 466–492 | Hằng & state | `TYPES` (loại lịch), **`TABS`**, `ROLE`, `EXT`, `ACCEPT_*`, `DEFAULT_AI_TOOLS`, **`S`** (state toàn cục) |
| 494–516 | Quyền & UI nhỏ | `W/A/mine` (= `S.editMode`), `sched` (render qua rAF), `toast`, `friendly` (thông báo lỗi) |
| 517–584 | **Đồng bộ dữ liệu** | `stateList`, `sharedSnapshot`, `persistState` (PUT /api/state), `syncShared` (GET), `loadState`, `enqueue`, `saveDoc`, `addDoc`, `delDoc`, **`mutate(col,…)`**, `dropAssets` |
| 585–631 | **Upload tệp** | `guessType`, `shrink` (nén ảnh), **`upload`** (≤3 MiB → /api/github, lớn hơn → /api/upload chunk) |
| 632–662 | Khởi động | `mediaSrc`, `itemHref`, `kindLabel`, `ownerName`, `ensureNames`, **`init`** |
| 663–714 | Modal/Form/Lightbox | `fieldHtml`, `closeModal`, **`openForm({title,fields,onSubmit})`**, `confirmBox`, `openLb`, `renderLb` |
| 715–771 | Tab **Lịch học** | `occurrences` (lặp theo tuần), `chipHtml`, `evRow`, `viewLich`, `eventForm` |
| 772–783 | Tab **Thông báo** | `viewThongBao` |
| 784–806 | Tab **Tài liệu** | `viewTaiLieu`, `folderOptions` |
| 807–966 | Tab **Học phần** | `viewHocPhan`, `itemList`, `sectAdd`, `courseDetail` (bài giảng), `lectureNotes*`, `noteForm`, `sanitizeAnswerHtml`, `answerMarkup/Preview`, `richEditorHtml`, `setupRichEditors` (editor rich text), `reviewQuestions*`, `reviewQuestionForm`, `courseWordHtml` (xuất Word), `curCourse`, `curLec` |
| 967–981 | Tab **Hình ảnh** | `viewHinhAnh`, `albumDetail` |
| 982–996 | Phân quyền/Thông tin lớp | `viewQuyen` |
| 997–1016 | **Render chính** | `render()` — vẽ `#tabs` + chọn view theo `S.tab` (map ở ~1012) |
| 1017–1030 | Thiết bị/Thông báo | `safeNewsLink`, `devicePanel`, `checkUpdates` (poll 1 phút), **`setTab`** (lazy-load comments/reports/roster) |
| 1031–1053 | Dữ liệu mẫu | `seed`, `unseed` |
| 1054–1151 | **`const act={…}`** — handler cho `data-act` (core) | xem §3 |
| 1152–1192 | Tab **Nộp báo cáo** + **Nhật ký** | `reports`, `journal`, `reportRequest`, `loadReports`, `viewBaoCao`, `reportSubmissionsTable`, `reportForm`, `loadJournal`, `viewNhatKy`; `Object.assign(act,…)` ~1179 |
| 1195–1221 | Tab **AI-Tools** | `viewAiTools`, `aiToolForm`; act ~1215 |
| 1222–1236 | Tab **Danh sách lớp** | `roster`, `rosterSearchText`, `rosterMembers`, `rosterTable`, `viewDanhSach`, `loadRoster`; act ~1234; ô tìm `#rosterSearch` ~1235 |
| 1237–1253 | Khôi phục dữ liệu cũ | `recoveryPlan`, `merge`, `identity`; act `syncNow`, `recoverShared` ~1250 |
| 1255–1293 | Tab **Ý kiến** | `commentOwnerKey`, `feedbackCard`, `changeComment`, `viewYKien`, `loadComments`; act ~1279 |
| 1294–1353 | **Tin mới** (RSS, chỉ localStorage) | `readLocalJson`, `saveNewsLocal`, `newsLabel`, `newsItems`, `viewTinMoi`, `addNewsSource`, `feedText`, `refreshNews`; act ~1348 |
| 1354–1374 | Sự kiện toàn cục | `submit`, `click` (dispatch `data-act` → `act[name](el)`), `visibilitychange`, `keydown`, lỗi ảnh |

### 2.2 Tabs (`TABS` ~dòng 468 → view)

| id | Nhãn | View | Ghi chú |
|---|---|---|---|
| `lich` | Lịch học | `viewLich` | `S.events`, `S.cal` |
| `thongbao` | Thông báo | `viewThongBao` | `S.anns`, badge chưa đọc (`annSeen`) |
| `tailieu` | Tài liệu | `viewTaiLieu` | `S.folders`, `S.docs`, `S.folder` |
| `hocphan` | Học phần | `viewHocPhan`/`courseDetail` | `S.courses` (lectures, notes, reviewQuestions, items, images) |
| `hinhanh` | Hình ảnh | `viewHinhAnh`/`albumDetail` | `S.albums`, lightbox `S.lb` |
| `baocao` | Nộp báo cáo | `viewBaoCao` | API riêng `/api/reports` |
| `ykien` | Ý kiến | `viewYKien` | API riêng `/api/comments` |
| `danhsach` | Danh sách lớp | `viewDanhSach` | `data/class-roster.json` (chỉ đọc) |
| `aitools` | AI-Tools | `viewAiTools` | `S.aiTools` |
| `tinmoi`, `nhatky` | (không nằm trong TABS) | `viewTinMoi`, `viewNhatKy` | mở từ nút/toolbar Edit mode |

**Thêm tab mới:** thêm vào `TABS` + viết `viewXxx()` + thêm vào map trong `render()` (~1012) + `Object.assign(act,{…})` + CSS + nếu cần lazy-load thì sửa `setTab`.

## 3. Action (`data-act="tên"`) → vị trí handler

Tìm nhanh: `grep -n "tênAction:" index.html`.

| Nhóm | Actions | Dòng ~ |
|---|---|---|
| Chung | `notifications`, `editMode`, `tab`, `closeModal`, `editClass`, `seed`, `unseed` | 1055–1065, 1148–1150 |
| Lịch | `calPrev`, `calNext`, `calToday`, `selDay`, `addEvent`, `editEvent`, `delEvent` | 1066–1072 |
| Thông báo | `addAnn`, `pinAnn`, `delAnn` | 1073–1087 |
| Tài liệu | `openFolder`, `addFolder`, `delFolder`, `upDoc`, `linkDoc`, `editDoc`, `delDoc` | 1088–1102 |
| Học phần | `addCourse`, `openCourse`, `backCourses`, `selLecture`, `editCourse`, `delCourse`, `addLecture`, `renameLecture`, `delLecture`, `exportCourseWord`, `add/edit/delReviewQuestion`, `add/edit/delNote`, `addItem`, `delItem`, `addLecImg`, `delLecImg`, `openLecImg` | 1103–1132 |
| Hình ảnh | `addAlbum`, `openAlbum`, `backAlbums`, `addPhotos`, `delAlbum`, `openPhoto`, `lbClose`, `lbPrev`, `lbNext`, `lbDel` | 1133–1147 |
| Báo cáo/Nhật ký | `reportSelect`, `reportsRefresh`, `reportCreate`, `reportEdit`, `reportSubmit`, `reportDeleteRound`, `reportDeleteSubmission`, `reportDeleteFile`, `logDate`, `logRefresh` | 1180–1191 |
| AI-Tools | `addAiTool`, `editAiTool`, `deleteAiTool` | 1216–1218 |
| Danh sách | `rosterRefresh`, `rosterGroup` | 1234 |
| Đồng bộ | `syncNow`, `recoverShared` | 1251–1252 |
| Ý kiến | `commentEdit`, `commentVote`, `commentDelete`, `commentsRefresh`, `commentAdd` | 1280–1287 |
| Tin mới | `newsRefresh`, `newsMode`, `newsRemove`, `newsSave` | 1349–1352 |

## 4. Luồng dữ liệu

- **Dữ liệu lớp chung** (`events, anns, folders, docs, courses, albums, cls, aiTools`): `init` → `syncShared` (GET `/api/state`) → `S.*`. Ghi: `mutate`/`addDoc`/`saveDoc`/`delDoc` → `persistState` → PUT `/api/state` (cần mật khẩu Edit mode + revision SHA; 409 nếu xung đột). Lỗi ghi giữ `solop.pendingState`.
- **Upload**: `upload()` → ≤3 MiB: `/api/github?path=` ; >3 MiB: `/api/upload` (chunk 2 MiB → finalize). Đường dẫn do `uploadPath`/`*UploadContext` tạo, lưu vào `uploads/…`.
- **Ý kiến / Báo cáo**: file JSON riêng, API riêng, không đi qua `/api/state`.
- **Audit**: server gọi `audit()` trong `lib/github-store.js` → `data/logs/<ngày UTC+7>/…json`; lỗi audit → header `X-Audit-Status: failed`.
- **Chỉ trên thiết bị (localStorage `solop.*`)**: `tab, annSeen, notify, commentName, commentOwnerKey, commentVoterId, reportName, reportStudentId, newsSources, newsCache, newsSaved, rssUrl, rssCache, pendingState, recoveryState`.
- **Edit mode**: `S.editMode`; mật khẩu chỉ giữ trong bộ nhớ tab, gửi kèm request; server so với `EDIT_PASSWORD` (`editor()` trong github-store).

## 5. "Muốn sửa X → mở đâu"

| Việc cần làm | Chỗ cần xem |
|---|---|
| Đổi màu/giao diện chung | `index.html` dòng 1–4 (`:root`) và 8–392 |
| Đổi tên lớp/hero | khung HTML ~393–404, `act.editClass`, `S.cls` |
| Thêm trường cho lịch | `eventForm`, `evRow`, `occurrences` |
| Thêm trường form bất kỳ | `openForm` / `fieldHtml` (kiểu field) + handler `act.*` tương ứng |
| Giới hạn/loại tệp upload | `upload`, `ACCEPT_*`, `EXT`, `api/github.js`, `api/upload.js` |
| Editor rich text / ghi chú bài giảng | `richEditorHtml`, `setupRichEditors`, `sanitizeAnswerHtml` |
| Xuất Word học phần | `courseWordHtml`, `act.exportCourseWord` |
| Logic báo cáo (hạn, giới hạn tệp) | client `viewBaoCao`/`reportForm`; server `api/reports.js` |
| Ý kiến (giới hạn, vote, quyền sửa) | `feedbackCard`, `changeComment`; `api/comments.js` |
| Đồng bộ / xung đột dữ liệu | `syncShared`, `persistState`, `checkUpdates`; `api/state.js` |
| RSS | `refreshNews`, `addNewsSource`; `api/rss.js` |
| Danh sách lớp | `data/class-roster.json`, `rosterTable`, `viewDanhSach` |
| Biến môi trường / GitHub | `lib/github-store.js` (`settings`) |

## 6. Kiểm thử

```
node tests/check.cjs        # tổng quát trang, mật khẩu, upload path, 2 file HTML giống nhau
node tests/api.cjs          # api/github.js
node tests/sync.cjs         # api/state.js + đồng bộ
node tests/upload.cjs       # api/upload.js (50 MiB mock)
node tests/delete-upload.cjs
node tests/features.cjs     node tests/courses.cjs   node tests/rich-answer.cjs
node tests/comments.cjs     node tests/comments-ui.cjs
node tests/reports.cjs      node tests/reports-ui.cjs
node tests/roster.cjs       node tests/news.cjs      node tests/rss.cjs
```
Test UI trích `<script>` từ `index.html` và chạy trong `node:vm` — đổi tên hàm có thể làm test hỏng.

## 7. Bảo trì bản đồ này
Khi thêm/xoá tab, action, API hoặc file dữ liệu: cập nhật bảng tương ứng. Số dòng lệch nhẹ là bình thường.
