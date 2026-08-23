# PDFTools

Ứng dụng web xử lý PDF và ảnh, xây dựng bằng React, Vite, Node.js và Express.

## Tính năng đang hoạt động

- Nén, đổi định dạng, đổi kích thước và cắt ảnh, với preview trước/sau và thống kê dung lượng thực tế.
- Cắt ảnh bằng khung kéo-thả, di chuyển và thu phóng trực tiếp; hỗ trợ tỷ lệ tự do, 1:1, 4:3 và 16:9.
- Xóa phông bằng AI chạy trong trình duyệt (JPG, PNG, WebP). Chế độ Nhanh dùng mô hình ~40 MB; Chất lượng cao dùng ~80 MB. Mô hình được tải và lưu cache khi dùng lần đầu.
- Preview PDF bằng PDF.js, có điều hướng từng trang.
- Nén PDF theo dung lượng MB thực tế, tự cân chỉnh nhiều lượt để kết quả nằm sát phía dưới mục tiêu; có chế độ bảo toàn văn bản riêng.
- Ghép PDF bằng bảng thumbnail: chọn, kéo đổi thứ tự, xoay, xóa và chèn thêm PDF tại vị trí mong muốn.
- Tách PDF bằng cách chọn trực tiếp thumbnail, hỗ trợ chọn tất cả, trang lẻ, trang chẵn và xoay trước khi xuất ZIP.
- Dark mode, tìm kiếm công cụ và giao diện responsive.

Các mục PDF sang Word/Excel/PowerPoint, chỉnh sửa nội dung PDF và chỉnh sửa ảnh nâng cao hiện đang hiển thị là “đang hoàn thiện”; không nên coi chúng là đã triển khai.

## Chạy trên máy mới

### 1. Cài đặt yêu cầu

- Node.js 20 LTS hoặc mới hơn.
- Git.
- Tài khoản GitHub có quyền với repository này nếu repository là private.

### 2. Clone và cài dependencies

```bash
git clone https://github.com/phamcongdanh98/Web-tool-ALL.git
cd Web-tool-ALL
npm ci
```

### 3. Cấu hình (tùy chọn)

Ứng dụng chạy không cần MongoDB. Nếu muốn dùng database sau này, sao chép file mẫu và đặt chuỗi kết nối:

```bash
copy .env.example .env
```

Sửa `MONGODB_URI` trong `.env`. Không commit file `.env`.

### 4. Chạy dự án

```bash
npm run dev
```

Lệnh này chạy đồng thời:

- React/Vite client tại `http://localhost:5175`.
- Express API tại `http://localhost:3001`.

Để tạo production build:

```bash
npm run build
```

## Dùng Codex trên nhiều máy

Mỗi máy chỉ cần cài Codex, đăng nhập cùng tài khoản ChatGPT, sau đó clone repository và chạy `codex` ngay trong thư mục dự án:

```bash
cd Web-tool-ALL
codex
```

Codex sẽ đọc `AGENTS.md` trong repository để hiểu cấu trúc, lệnh kiểm tra và các quy ước của dự án. Để đồng bộ giữa các máy:

```bash
# Trước khi bắt đầu trên máy mới
git pull --ff-only
npm ci

# Sau khi hoàn thành thay đổi
git add .
git commit -m "mô tả thay đổi"
git push
```

Tránh làm việc đồng thời trên cùng một nhánh ở nhiều máy. Khi cần làm song song, tạo nhánh riêng trên mỗi máy rồi mở pull request để gộp.

Sau mỗi lần Codex thay đổi code, hãy xem mục **Nhật ký thay đổi gần đây** bên dưới và trạng thái Git được báo ở cuối công việc. Chỉ coi hai máy đã đồng bộ sau khi thay đổi được commit và push lên GitHub.

Codex CLI chạy trực tiếp trên repository cục bộ, có thể đọc/sửa/chạy lệnh trong dự án. Bạn có thể cài và đăng nhập theo [hướng dẫn Codex chính thức](https://learn.chatgpt.com/docs/codex/cli).

## Cấu trúc chính

```text
src/App.jsx       Giao diện React và luồng xử lý tệp
src/styles.css    Hệ thống giao diện và responsive layout
server.js         Express API xử lý ảnh/PDF
vite.config.js    Vite và proxy /api sang Express
.env.example      Biến môi trường mẫu
AGENTS.md         Hướng dẫn dành cho Codex
```

## Nhật ký thay đổi gần đây

### 2026-08-23

- Thêm nén PDF theo dung lượng mục tiêu thực tế; thử nghiệm PDF 6,75 MB xuống 3,86 MB với mục tiêu 4 MB.
- Thiết kế lại ghép và tách PDF bằng thumbnail trực quan; thứ tự, trang bị xóa và góc xoay được áp dụng thật vào kết quả backend.
- Thêm preview PDF bằng PDF.js và cải thiện khu vực chọn tệp để hỗ trợ kéo-thả, chọn tệp và chèn thêm PDF.
- Kiểm thử: `npm run build`; ghép 4 trang có đổi thứ tự và xoay; tách trang 1 và 3 thành ZIP; kiểm tra preview và liên kết tải kết quả.
- Dependency mới: `pdfjs-dist`. Khi cập nhật trên máy còn lại, cần chạy `git pull --ff-only` rồi `npm ci`.
- Trạng thái tại thời điểm ghi chú: thay đổi đang ở máy cục bộ, chưa commit và chưa push.

## Lưu ý về xóa phông AI

Ảnh được xử lý local trong browser, không gửi tệp lên Express API. Lần đầu người dùng phải có Internet để tải mô hình AI; sau đó browser cache model. Thư viện `@imgly/background-removal` có giấy phép AGPL, nên cần xem xét yêu cầu giấy phép trước khi phát hành sản phẩm thương mại.
