# K02A02 Notebook

Trang tĩnh: `index.html` và `Sổ lớp.html` có nội dung giống nhau.

## Lưu tệp trên GitHub

1. Bật Edit mode, chọn **Kết nối GitHub**.
2. Nhập repository công khai dạng `chu-so-huu/ten-repo`, nhánh `main` (phải tồn tại).
3. Nhập fine-grained GitHub token có quyền **Contents: Read and write** cho repository này. Token chỉ được giữ trong bộ nhớ của tab, cần nhập lại khi tải lại trang. Không ghi token vào HTML hay commit lên repository.
4. Tải tài liệu hoặc ảnh từ mục tương ứng. Tệp chỉ được thêm vào danh sách sau khi GitHub xác nhận upload.

Giới hạn mỗi tệp: 100 × 1024 × 1024 byte (100 MiB, giao diện ghi 100 MB). Ảnh JPEG/PNG/WebP lớn được nén như trước. Không còn nhúng tệp mới dạng base64 vào localStorage.

Cấu trúc tự tạo:

```text
uploads/
  tai-lieu/<ten-thu-muc>/
  hoc-phan/<ma-ten-hoc-phan>--<id>/<ten-bai>--<id>/
    tai-lieu/
    tham-khao/
    hinh-anh/
  album/<ngay>-<ten-album>--<id>/
data/solop-static.json
```

Tên tệp: `<ten-goc-khong-dau>--<thoi-diem>-<ma-ngau-nhien>.<duoi>`. Giữ tên gốc có dấu trên giao diện. Ảnh chuyển sang JPEG sẽ có đuôi `.jpg`. ID giúp phân biệt học phần/album trùng tên. Đổi tên mục sau này không di chuyển các tệp đã lưu.

Các thao tác ghi tệp và metadata được xếp hàng để tránh xung đột commit trong cùng tab. Lỗi GitHub được hiển thị và không được coi là upload thành công. Metadata có bản lưu tại trình duyệt; nếu đồng bộ metadata lỗi sau khi upload, tệp có thể đã nằm trong repository, cần kiểm tra trước khi tải lại để tránh bản trùng.

Xoá tài liệu/ảnh khỏi giao diện chỉ bỏ tham chiếu; tệp trong GitHub được giữ lại để tránh mất dữ liệu. Các tệp base64 cũ chưa tự động chuyển lên GitHub, cần tải lại qua luồng mới.

## Dùng trên GitHub Pages / Vercel

Đặt các tệp tại thư mục gốc website; dùng `index.html` làm trang chủ. Vercel dùng cấu hình tĩnh trong `vercel.json`. Khi repo chứa website cũng là repo dữ liệu, `data/solop-static.json` là bản dữ liệu chung sau khi triển khai. Nếu dùng repo lưu trữ riêng, khai báo `window.CLASS_CONFIG` trước script chính với `githubRepo` và `githubBranch` (không đưa token vào cấu hình công khai), hoặc kết nối repository trong từng trình duyệt.

Trang đọc metadata từ repository đã chọn (hoặc `./data/solop-static.json`) khi khởi động nếu bản đó mới hơn dữ liệu cục bộ. Đây chưa phải cơ chế hợp nhất khi nhiều người chỉnh sửa cùng lúc. Repository công khai đồng nghĩa tệp tải lên cũng công khai.

## Kiểm tra

Chạy `node tests/check.cjs`. Kiểm thử gồm chức năng trang, xác thực mật khẩu, đường dẫn upload, ngưỡng dung lượng, lỗi API, metadata SHA và việc không lưu token. API được mô phỏng; không gửi tệp thật 100 MB hoặc commit vào repository thực.
