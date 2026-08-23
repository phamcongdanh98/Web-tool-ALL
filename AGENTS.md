# Hướng dẫn dự án cho Codex

## Mục tiêu

Đây là ứng dụng PDFTools tiếng Việt. Ưu tiên giữ giao diện một trang hiện đại và các xử lý tệp rõ ràng, có kết quả tải xuống được.

## Kiến trúc

- `src/App.jsx`: toàn bộ giao diện React và state của các modal công cụ.
- `src/styles.css`: kiểu giao diện. Không thêm framework CSS trừ khi người dùng yêu cầu.
- `server.js`: Express API. Dùng `sharp` cho ảnh, `pdf-lib` cho PDF và `archiver` cho ZIP.
- `vite.config.js`: Vite proxy `/api` đến Express ở cổng 3001.

## Lệnh cần dùng

```bash
npm ci
npm run dev
npm run build
```

`npm run dev` phải khởi chạy cả Express lẫn Vite. Không đổi sang chỉ chạy Vite nếu các công cụ API vẫn cần hoạt động.

## Quy ước thay đổi

- Chỉ tuyên bố một công cụ “hoạt động” sau khi đã kiểm thử đường đi thật: chọn tệp → xử lý → tải tệp kết quả.
- Các công cụ PDF sang Office, chỉnh sửa nội dung PDF và chỉnh sửa ảnh nâng cao chưa được triển khai; giữ nhãn “đang hoàn thiện” cho đến khi có backend đúng nghĩa.
- Xóa phông dùng `@imgly/background-removal` ở phía client. Chỉ nhận JPG, PNG và WebP. Lần đầu chạy phải tải model AI; giữ hiển thị tiến độ cho người dùng.
- Không commit `.env`, `node_modules`, `dist` hoặc cấu hình IDE cục bộ.
- Sau mỗi thay đổi UI/API đáng kể, chạy `npm run build`.
- Sau mỗi công việc làm thay đổi code, cấu hình hoặc dependency, cập nhật mục **Nhật ký thay đổi gần đây** trong `README.md`. Ghi ngắn gọn ngày, nội dung đã làm, kiểm thử đã chạy và lưu ý cần thiết khi mở dự án trên máy khác.

## Đồng bộ khi dùng hai máy

- Luôn chạy `git status` trước khi bắt đầu để tránh ghi đè thay đổi chưa commit từ máy khác.
- Trước khi sửa code, chạy `git pull --ff-only`. Nếu pull bị chặn vì thay đổi cục bộ, dừng lại và báo rõ; không tự xóa hoặc reset thay đổi.
- Nếu `package.json` hoặc lockfile thay đổi, ghi rõ trong `README.md` và nhắc chạy `npm ci` trên máy còn lại.
- Kết thúc mỗi công việc phải nói rõ trạng thái: **chưa commit**, **đã commit nhưng chưa push**, hoặc **đã push**, kèm commit hash khi có.
- Không được nói hai máy đã đồng bộ nếu commit mới nhất chưa được push lên remote.
- Khi chuyển sang máy còn lại: pull trước, chạy `npm ci` nếu dependency thay đổi, rồi chạy lại build hoặc kiểm thử liên quan.
- Không làm đồng thời trên cùng nhánh ở hai máy. Nếu cần làm song song, dùng nhánh riêng có tiền tố `codex/` và gộp qua pull request.

## Git

- Nhánh chính: `main`.
- Trước khi bắt đầu: `git pull --ff-only`.
- Kiểm tra thay đổi bằng `git status` trước khi commit.
- Dùng commit message ngắn, mô tả được thay đổi, ví dụ: `fix: repair PDF split output`.
- Chỉ commit hoặc push khi người dùng yêu cầu; nếu chưa được yêu cầu, giữ thay đổi cục bộ và báo rõ để tránh hiểu nhầm trên máy còn lại.
