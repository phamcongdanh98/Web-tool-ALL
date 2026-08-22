# PDFTools

Ứng dụng web xử lý PDF và ảnh, xây dựng bằng React, Vite, Node.js và Express.

## Tính năng đang hoạt động

- Nén, đổi định dạng, đổi kích thước và cắt ảnh.
- Xóa phông bằng AI chạy trong trình duyệt (JPG, PNG, WebP). Chế độ Nhanh dùng mô hình ~40 MB; Chất lượng cao dùng ~80 MB. Mô hình được tải và lưu cache khi dùng lần đầu.
- Nén PDF, ghép PDF và tách từng trang PDF thành ZIP.
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

- React/Vite client (thường tại `http://localhost:5173`).
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

## Lưu ý về xóa phông AI

Ảnh được xử lý local trong browser, không gửi tệp lên Express API. Lần đầu người dùng phải có Internet để tải mô hình AI; sau đó browser cache model. Thư viện `@imgly/background-removal` có giấy phép AGPL, nên cần xem xét yêu cầu giấy phép trước khi phát hành sản phẩm thương mại.
