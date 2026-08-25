# Roadmap đã kiểm chứng của PDFTools

Tài liệu này phân loại ý tưởng theo code đang có, khả năng kiểm thử và tài nguyên production hiện tại. Không đưa card “Sẵn sàng” lên giao diện trước khi luồng chọn tệp → cấu hình/preview → xử lý → kiểm tra output → tải xuống đã hoạt động thật.

## Đã làm ngay

| Hạng mục | Quyết định | Lý do |
| --- | --- | --- |
| Sắp xếp PDF | Đã triển khai | Tái sử dụng `PdfPageBoard` và API `pagePlan`; hỗ trợ kéo-thả, xoay, nhân bản, thêm, xóa và preview PDF kết quả. |
| Giới hạn tài nguyên API | Đã triển khai | VPS nhỏ cần trần tổng request 50 MB, 500 trang PDF, tối đa 2 tác vụ đồng thời, kiểm tra PDF/ảnh thật và giới hạn ảnh 30 megapixel. |
| PDF → Word có cấu trúc | Đã triển khai, mặc định | Phân loại scan/PDF hỗn hợp/Word-export/PDF ký số; gom dòng thành đoạn, phục hồi tiêu đề hai cột và bảng `STT`, tách ảnh/dấu/chữ ký thành PNG trong suốt rồi neo theo tọa độ trang. Không tuyên bố khôi phục DOCX gốc hoặc hiệu lực chữ ký. |
| PDF → Word giữ vị trí từng dòng | Đã triển khai, dự phòng | Browser tách chữ thành text box theo tọa độ/font/cỡ/màu và render phần đồ họa còn lại làm nền 200 DPI. Chỉ dùng khi cấu trúc lạ làm chế độ mặc định chưa phù hợp; khó reflow và có thể khác giữa Word/LibreOffice. |
| Overlay chữ PDF trực tiếp | Đã triển khai | Canvas cho phép nhấp/kéo vị trí, tinh chỉnh x/y phần trăm; API clamp và đổi đúng hệ tọa độ trước khi thêm lớp chữ mới. |
| Tạo và đọc mã QR | Đã triển khai | `qrcode` tạo PNG và tự đọc lại để kiểm tra; `jsQR` đọc ảnh JPG/PNG/WebP. Cả hai lazy-load, chạy trong browser, hỗ trợ tiếng Việt và không tự mở URL. |
| Đổi tên file hàng loạt | Đã triển khai | Preview tên cũ → tên mới, chặn ký tự/path nguy hiểm và tên trùng; JSZip đóng gói tối đa 100 tệp/50 MB mà không sửa byte nội dung. |
| Che thông tin ảnh | Đã triển khai | Người dùng kéo và thu phóng tối đa 20 khối màu đặc; Sharp làm phẳng khối vào PNG và bỏ metadata EXIF/GPS. Không dùng blur/pixel hóa để gọi là che riêng tư. |
| Refactor | Làm tăng dần | Chỉ tách module khi chạm vào flow có test; không đại tu toàn bộ `App.jsx` trong một lần. |

## Ưu tiên tiếp theo

1. **Ảnh → PDF**: nhiều người dùng, có thể tái sử dụng preview/kéo-thả; phải có thứ tự ảnh, A4/Letter, hướng trang, fit/fill, margin và E2E kiểm tra số trang/kích thước.
2. **PDF → JPG/PNG/WebP**: tận dụng PDF.js; cần chọn trang, DPI, giới hạn pixel/RAM, ZIP và preview output thật.
3. **Batch ảnh**: chỉ làm sau khi có giới hạn tổng file, số file, concurrency và ZIP streaming rõ ràng.
4. **Xóa nền hậu xử lý**: nền màu/ảnh và brush khôi phục/xóa; cần giữ mask gốc, undo và cleanup canvas/model.
5. **Mở rộng editor PDF overlay**: nền tảng kéo chữ đã có; bước tiếp theo là ảnh, chữ ký, shape, highlight và undo/redo, vẫn không mô tả là sửa chữ gốc.

## Đúng về hướng đi nhưng chưa phù hợp VPS hiện tại

| Hạng mục | Điều kiện trước khi làm |
| --- | --- |
| OCR tiếng Việt/Anh | Worker hoặc container cô lập, queue, timeout/cancel, giới hạn trang/DPI, dung lượng tạm và đánh giá license. OCRmyPDF lưu ý public service cần phòng PDF độc hại/DoS, giới hạn CPU và có thể cần khoảng 100 MB tạm mỗi trang. |
| Word/Excel/PowerPoint → PDF | LibreOffice headless, thư mục tạm riêng, profile riêng cho từng job, timeout/kill process, cleanup, concurrency 1 và test fidelity bằng LibreOffice thật. |
| Protect/Unlock PDF | Cài `qpdf`, truyền password qua file/stdin thay vì command line, cleanup file tạm và kiểm thử mở bằng password đúng/sai. Permission PDF không phải DRM tuyệt đối. |
| Nén “cân bằng” giữ text/vector nhưng nén ảnh | `pdf-lib` hiện chỉ tối ưu cấu trúc. Muốn nén ảnh nhúng mà vẫn giữ semantics cần engine khác và bộ fixture kiểm tra chữ/link/form. |
| Rút gọn liên kết public | Database bền vững ngoài thư mục release, backup/migration, slug ngẫu nhiên chống va chạm, hết hạn/vô hiệu hóa, rate limit, báo cáo/chặn spam-phishing và chỉ redirect HTTP/HTTPS. Không dùng bộ nhớ tiến trình vì link sẽ mất khi restart/deploy. |

## Chưa cần làm

- **Chat PDF, AI tóm tắt/dịch**: cần nhà cung cấp model, chi phí, giới hạn dữ liệu, chính sách riêng tư và chống abuse; chưa phù hợp sản phẩm miễn phí không đăng nhập.
- **Redact nội dung bên trong PDF, Repair, PDF/A, Compare và Forms nâng cao**: giá trị có nhưng yêu cầu kiểm chứng semantic/chuyên biệt; rectangle phủ lên PDF có thể bị gỡ và làm lộ dữ liệu. Công cụ hiện tại chỉ redact ảnh bằng cách ghi đè pixel thật.
- **Sửa trực tiếp chữ gốc như Acrobat**: không phù hợp `pdf-lib` hiện tại và dễ hỏng font/glyph/content stream.
- **Thêm hàng chục card “sắp ra mắt”**: làm loãng giao diện và tạo kỳ vọng sai; chỉ hiện công cụ khi đã hoàn thành E2E.

## Nguồn kỹ thuật và thị trường

- [iLovePDF – danh mục công cụ chính thức](https://www.ilovepdf.com/)
- [Smallpdf – danh mục công cụ chính thức](https://smallpdf.com/)
- [Smallpdf – PDF sang Word, công khai hợp tác với Solid Documents](https://smallpdf.com/vi/pdf-to-word)
- [Solid Documents – Flowing/Continuous/Exact, nhận diện bảng và header/footer](https://www.soliddocuments.com/convert/PDF-to-Word/303/12)
- [OCRmyPDF – lưu ý khi triển khai online](https://ocrmypdf.readthedocs.io/en/stable/cloud.html)
- [LibreOffice – chuyển đổi định dạng bằng command line](https://help.libreoffice.org/latest/en-US/text/shared/guide/convertfilters.html)
- [qpdf – tùy chọn mã hóa/giải mã](https://qpdf.readthedocs.io/en/stable/cli.html)
- [Microsoft Support – cách Word chuyển PDF và các giới hạn bố cục](https://support.microsoft.com/en-us/word/opening-pdfs-in-word)
- [PDF.js API – metadata, text content và cấu trúc trang](https://mozilla.github.io/pdf.js/api/)
- [node-qrcode – Browser API và mức sửa lỗi QR](https://github.com/soldair/node-qrcode/blob/master/README.md)
- [jsQR – đọc QR thuần JavaScript từ ImageData](https://github.com/cozmo/jsQR)
- [OWASP – rủi ro open redirect và liên kết do người dùng kiểm soát](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)

## Quy tắc cập nhật

Khi thêm một công cụ hoặc thay đổi mức ưu tiên, cập nhật đồng thời `ROADMAP.md`, `DIAGRAMS.md`, nhật ký `README.md` và E2E semantic liên quan. Ghi rõ dependency hệ thống, RAM/disk/concurrency và bước setup VPS nếu có.
