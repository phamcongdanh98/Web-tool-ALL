# Bài học có thể chuyển giao giữa các dự án

Chỉ áp dụng phần liên quan đến repository đích. Đây là tiêu chí ra quyết định, không phải checklist bắt buộc cho mọi dự án.

## 1. Bắt đầu từ sự thật quan sát được

- Đọc manifest, lockfile, CI, test và entrypoint để xác nhận stack/lệnh; README có thể chậm hơn code.
- Phân biệt tính năng có UI với tính năng đã xử lý và trả đầu ra thật.
- Một lệnh trả exit code 0 không chứng minh toàn bộ luồng nghiệp vụ thành công.

## 2. Mô tả luồng từ góc nhìn người dùng hoặc caller

Một flow hữu ích phải nối được input tới output:

```text
input → validation → core processing → persistence/integration → output → verification
```

Với web tool, preview và download có thể là một phần của hợp đồng. Với CLI, artifact và exit status là đầu ra. Với library, giá trị trả về, side effect và error contract là đầu ra.

## 3. Thiết kế hợp đồng trước khi triển khai

- Xác định input, output, MIME/schema, tên artifact, giới hạn, timeout và lỗi dự đoán được.
- Client validation cải thiện UX; validation ở server/service boundary mới bảo vệ hệ thống.
- Những biến đổi nhìn thấy trong UI phải đi qua contract và được áp dụng thật ở core/backend.
- Lỗi gửi cho người dùng không lộ stack, filesystem path, query nhạy cảm hoặc secret.

## 4. Quản lý tài nguyên theo vòng đời

Khi dự án dùng file, browser media, worker, model AI hoặc in-memory upload:

- Đặt giới hạn theo từng item và tổng request/job; đánh giá peak memory thay vì chỉ kích thước file danh nghĩa.
- Cleanup object URL, bitmap, canvas, worker, stream, temp file và background task khi hoàn tất/hủy.
- Dynamic-load dependency nặng khi việc đó giảm startup cost mà không làm UX khó hiểu.
- Hiển thị tiến độ và fallback cho tác vụ dài; fallback phải bảo toàn correctness, không chỉ che lỗi.

## 5. Làm rõ hệ tọa độ, index và đơn vị

- Chọn một quy ước nội bộ và chuyển đổi ở ranh giới rõ: zero/one-based, percent/pixel, byte/MB, UTC/local time.
- Backend/core phải clamp hoặc validate lại dữ liệu đã chuyển đổi.
- E2E nên bắt các lỗi lệch trang, sai thứ tự, sai rotation, rounding hoặc timezone.

## 6. Test ý nghĩa của output

- HTTP 200 hoặc file không rỗng là chưa đủ.
- Parse/mở lại artifact bằng parser độc lập hoặc chính thư viện production khi phù hợp.
- Kiểm tra invariant: số trang, dimension, định dạng, schema, thứ tự, rotation, checksum, record count hoặc business state.
- Fixture nhỏ được sinh tự động thường an toàn và ổn định hơn file cá nhân.
- Flow phụ thuộc browser/GUI cần browser hoặc manual E2E; API test không thay thế hoàn toàn.

## 7. Một cổng verify duy nhất

Nếu dự án đủ lớn, gom các kiểm tra bắt buộc vào một lệnh `verify` hoặc task tương đương:

```text
syntax/format → lint/typecheck → tests → build → production smoke → critical E2E
```

CI chạy cùng cổng bằng runtime production. Security audit có thể nằm trong `verify` hoặc là job riêng, nhưng tài liệu phải nói rõ.

## 8. Dependency và tính trung thực

- Đánh giá nhu cầu, maintenance, license, bundle/runtime size và advisory trước khi thêm dependency.
- Không tuyên bố retention, encryption, persistence, privacy hoặc SLA nếu chưa có cơ chế và test tương ứng.
- Không nói dữ liệu đã lưu, xóa hoặc backup chỉ vì UI hiển thị thông báo.
- Tính năng chưa triển khai phải được gắn nhãn rõ thay vì trả output giả.

## 9. Release an toàn

Khi có production lâu dài:

- Git/registry là nguồn artifact chuẩn; không hot-fix source trên server.
- Build/preflight release mới trước khi chuyển traffic hoặc restart release đang chạy.
- Dùng release bất biến và chuyển phiên bản nguyên tử khi stack hỗ trợ.
- Health nội bộ kiểm tra runtime; public/synthetic check kiểm tra thêm proxy, DNS, TLS và route ngoài.
- Rollback phải biết release đích và được kiểm tra, không chỉ tồn tại trên giấy.
- Giữ lock/concurrency guard để tránh hai deploy đồng thời.

Không ép mô hình Nginx/systemd cho platform serverless, container orchestration hoặc desktop app; chuyển các invariant trên sang cơ chế tương ứng của nền tảng đích.

## 10. Nhiều máy, nhiều người và handoff

- Remote repository là điểm đồng bộ, không phải trạng thái local hoặc server.
- Kiểm tra status trước khi pull/sync; không reset thay đổi không rõ chủ sở hữu.
- Không làm đồng thời cùng nhánh khi có nguy cơ ghi đè; dùng branch/PR riêng.
- Handoff phải nêu file đổi, test, dependency/migration/setup mới và trạng thái commit/push/deploy.

## 11. Cách ghi bài học mới

Chỉ bổ sung một bài học khi có đủ ba yếu tố:

1. Bằng chứng từ code, test, incident hoặc hành vi đã quan sát.
2. Một invariant hoặc tiêu chí ra quyết định có thể diễn đạt rõ.
3. Phạm vi áp dụng và trường hợp không áp dụng.

Ưu tiên sửa một quy tắc hẹp sau lỗi thực tế thay vì tích lũy ngoại lệ và checklist chung chung.
