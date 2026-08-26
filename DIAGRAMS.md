# Sơ đồ hoạt động PDFTools

Tài liệu này là bản đồ trực quan của kiến trúc, luồng người dùng và toàn bộ chức năng đang hoạt động. Khi thêm, xóa, đổi tên hoặc chuyển nơi xử lý một chức năng, phải cập nhật file này trong cùng thay đổi code.

## 1. Kiến trúc và luồng dữ liệu

```mermaid
flowchart LR
    U["👤 Người dùng"] --> N["🌐 Nginx · HTTPS"]
    N -->|"Asset có hash"| S["📦 dist/assets · Brotli/Gzip"]
    N -->|"Trang và /api"| E["⚙️ Express · 127.0.0.1:3001"]
    E --> R["⚛️ React SPA"]
    R --> P["👁️ Chọn tệp · preview · cấu hình"]

    P --> C{"Xử lý ở đâu?"}
    C -->|"Trong browser"| B["🧠 PDF.js / Canvas / AI model / QR / ZIP"]
    C -->|"API nội bộ"| A["📤 Multipart /api/tools"]

    B --> B1["Nén PDF đặt MB"]
    B --> B2["Xóa phông AI"]
    B --> B3["Preview PDF / khung cắt"]
    B --> B4["Tạo + đọc QR cục bộ"]
    B --> B5["Đổi tên hàng loạt → ZIP"]

    A --> G["🛡️ Tổng 50 MB · nén PDF 50 MB/tệp<br/>công cụ khác 25 MB/tệp · 500 trang · 2 tác vụ"]
    G --> I["🖼️ Sharp · xử lý ảnh"]
    G --> D["📄 pdf-lib · PDF / ZIP"]
    G --> O["📝 PDF.js + DOCX / XLSX / PPTX / TXT"]

    B1 --> X["✅ Preview kết quả"]
    B2 --> X
    B4 --> X
    B5 --> X
    I --> X
    D --> X
    O --> X
    X --> T["⬇️ Tải tệp về máy"]

    classDef edge fill:#075985,stroke:#38bdf8,color:#fff;
    classDef browser fill:#4338ca,stroke:#a5b4fc,color:#fff;
    classDef server fill:#166534,stroke:#4ade80,color:#fff;
    classDef result fill:#9a3412,stroke:#fb923c,color:#fff;
    class U,N,S edge;
    class R,P,C,B,B1,B2,B3,B4,B5 browser;
    class E,A,G,I,D,O server;
    class X,T result;
```

Tệp được xử lý trong bộ nhớ hoặc trong browser. Luồng hiện tại không tạo kho lưu trữ tệp người dùng lâu dài.

## 2. Bản đồ chức năng

```mermaid
flowchart TB
    ROOT["PDFTools · 20 công cụ · 19 sẵn sàng"]
    ROOT --> PDF["📄 9 công cụ PDF"]
    ROOT --> IMG["🖼️ 7 công cụ ảnh"]
    ROOT --> UTL["🧰 4 công cụ tiện ích"]

    PDF --> PE["Chỉnh sửa PDF<br/>kéo overlay · tọa độ · số trang"]
    PDF --> PC["Nén PDF<br/>đặt MB / không mất dữ liệu"]
    PDF --> PM["Ghép PDF<br/>kéo thứ tự · xoay · chèn"]
    PDF --> PO["Sắp xếp PDF<br/>kéo-thả · nhân bản · xóa"]
    PDF --> PS["Tách PDF<br/>chọn thumbnail · xuất ZIP"]
    PDF --> PW["PDF sang Word<br/>đoạn + bảng + dấu/chữ ký"]
    PDF --> PX["PDF sang Excel"]
    PDF --> PP["PDF sang PowerPoint"]
    PDF --> PT["PDF sang văn bản"]

    IMG --> IR["Xóa phông nền<br/>AI trong browser"]
    IMG --> IC["Chuyển đổi định dạng<br/>JPG / PNG / WebP / AVIF"]
    IMG --> IZ["Thay đổi kích thước"]
    IMG --> IK["Cắt ảnh<br/>khung kéo-thả"]
    IMG --> IN["Nén ảnh"]
    IMG --> IE["Chỉnh sửa ảnh<br/>màu · xoay · lật"]
    IMG --> ID["Che thông tin<br/>kéo vùng · Sharp làm phẳng · bỏ EXIF"]

    UTL --> QC["Tạo mã QR<br/>preview · tự kiểm tra đọc lại"]
    UTL --> QR["Đọc mã QR<br/>ảnh cục bộ · không tự mở link"]
    UTL --> BR["Đổi tên file hàng loạt<br/>preview tên · ZIP giữ nguyên byte"]
    UTL --> LS["Rút gọn liên kết<br/>đang nghiên cứu persistence + chống abuse"]

    classDef root fill:#312e81,stroke:#a5b4fc,color:#fff;
    classDef pdf fill:#075985,stroke:#38bdf8,color:#fff;
    classDef image fill:#166534,stroke:#4ade80,color:#fff;
    classDef utility fill:#9a3412,stroke:#fb923c,color:#fff;
    classDef planned fill:#713f12,stroke:#facc15,color:#fff,stroke-dasharray: 5 5;
    class ROOT root;
    class PDF,PE,PC,PM,PO,PS,PW,PX,PP,PT pdf;
    class IMG,IR,IC,IZ,IK,IN,IE,ID image;
    class UTL,QC,QR,BR utility;
    class LS planned;
```

## 3. Luồng sử dụng chung

```mermaid
flowchart LR
    O["Mở / tải lại website"] --> W["Splash 6,7 giây · có Bỏ qua<br/>PDF → 4 engine → Công Cụ Web<br/>signature Danh Phạm → logo về header"]
    W --> A["Chọn công cụ"]
    A --> A0{"Loại thao tác?"}
    A0 -->|"Tạo QR"| Q0["Nhập text/link · preview · kiểm tra đọc lại"]
    Q0 --> L
    A0 -->|"Công cụ dùng tệp"| B["Kéo-thả hoặc chọn tệp"]
    B --> C{"Tệp hợp lệ?"}
    C -- "Không" --> D["Thông báo lỗi rõ ràng"]
    D --> B
    C -- "Có" --> E["Preview bản gốc"]
    E --> F["Điều chỉnh thông số"]
    F --> G["Xử lý thật"]
    G --> H{"Thành công?"}
    H -- "Không" --> I["Giữ tệp gốc · hướng dẫn xử lý"]
    I --> F
    H -- "Có" --> J["Preview trước / sau"]
    J --> K["Dung lượng · kích thước · số trang"]
    K --> L["Tải kết quả"]
```

## 4. Luồng PDF sang Word và chỉnh PDF

```mermaid
flowchart TD
    F["📄 PDF đầu vào"] --> Z{"Kiểu Word?"}
    Z -->|"Word có cấu trúc · mặc định"| M["API đọc metadata · chữ/font<br/>toán tử ảnh · trường chữ ký"]
    M --> K{"Loại PDF?"}
    K -->|"Không có lớp chữ"| S["Scan · HTTP 422 · hướng dẫn OCR"]
    K -->|"Chữ + trang ảnh"| H["PDF hỗn hợp · cảnh báo trang chưa OCR"]
    K -->|"Có /Sig hoặc /ByteRange"| V["PDF văn bản đã ký số"]
    K -->|"Creator/Producer là Word"| W["Có dấu hiệu xuất từ Word"]
    K -->|"Có chữ khác"| D["PDF số thông thường"]
    H --> R["Tái dựng phần chữ hiện có"]
    V --> R
    W --> R
    D --> R
    R --> GL["Tách ảnh / dấu / chữ ký<br/>PNG trong suốt · neo theo trang"]
    R --> T{"Nhận diện bố cục"}
    T -->|"Nhiều dòng"| B["Gom đoạn · căn đều · first-line indent"]
    T -->|"STT + cột số liệu"| Q["Bảng Word thật · border · ô gộp"]
    T -->|"Tiêu đề / nơi nhận"| X["Hai cột · khoảng cách theo PDF"]
    B --> O["DOCX khổ trang gốc<br/>structured reconstruction"]
    Q --> O
    X --> O
    GL --> O
    O --> C["Đoạn + bảng chỉnh sửa được<br/>giữ phần nhìn thấy của chữ ký"]

    Z -->|"Giữ vị trí từng dòng · dự phòng"| E["Browser đọc text item + toán tử trang<br/>200 DPI · giới hạn 40 trang"]
    E --> K0{"Có lớp chữ?"}
    K0 -->|"Không / trang ảnh"| S
    K0 -->|"Có"| I["Render nền không có chữ<br/>giữ đường kẻ · ảnh · dấu · chữ ký"]
    I --> J["Mỗi dòng → text box Word<br/>tọa độ · font · cỡ · màu · độ co"]
    J --> Y["DOCX đúng khổ · lề 0<br/>ưu tiên vị trí hơn reflow"]

    F --> P["Canvas preview chỉnh PDF"]
    P --> G["Nhấp/kéo overlay · tọa độ tâm x/y % từ góc trên-trái"]
    G --> A["API clamp + đổi sang hệ tọa độ PDF"]
    A --> L["Giữ nội dung gốc · thêm lớp chữ mới"]

    classDef decision fill:#27272a,stroke:#a1a1aa,color:#fff;
    classDef warn fill:#9a3412,stroke:#fb923c,color:#fff;
    classDef ok fill:#166534,stroke:#4ade80,color:#fff;
    class Z,K0,K decision;
    class S,H warn;
    class E,I,J,Y,V,W,D,R,T,B,Q,X,O,C,P,G,A,L ok;
```

## 5. Production, cập nhật và bảo trì

```mermaid
flowchart TD
    S["setup-ubuntu.sh"] --> Q{"apt đang bị khóa?"}
    Q -- "Có" --> W["Chờ an toàn tối đa 10 phút"]
    W --> Q
    Q -- "Không" --> A["Release cũ đang phục vụ"]
    R["Mac build dist<br/>bỏ xattr + SHA-256"] --> U["Upload artifact qua SSH timeout/keepalive"]
    U --> V{"Đúng commit + checksum?"}
    V -- "Không" --> A
    V -- "Có" --> X{"Cache dependency có sẵn?"}
    X -- "Không" --> T{"Lockfile trùng release hiện tại?"}
    T -- "Có" --> AA["Seed cache bằng hard-link"]
    AA --> B
    T -- "Không" --> Y{"RAM/load hợp lệ<br/>GNU awk + đủ an toàn?"}
    Y -- "Không" --> A
    Y -- "Có" --> Z["npm ci production có timeout"]
    X -- "Có" --> B["Tạo release mới độc lập"]
    Z --> B
    B --> C{"Preflight đạt?"}
    C -- "Không" --> A
    C -- "Có" --> D["Chuyển symlink + restart systemd"]
    D --> E{"Express phản hồi?"}
    E -- "Có" --> F["Health nội bộ + HTTPS"]
    E -- "502 / 503 / 504" --> M["Trang bảo trì độc lập"]
    G["maintenance:vps on"] --> M
    M --> H["HTTP 503 · Retry-After 15"]
    H --> I["Tự tải lại / người dùng thử lại"]
    F --> J{"Health đạt?"}
    J -- "Không" --> K["Rollback release trước"]
    J -- "Có" --> L["Phiên bản mới hoạt động"]
    K --> A
    N["maintenance:vps off"] --> L

    classDef ok fill:#166534,stroke:#4ade80,color:#fff;
    classDef wait fill:#9a3412,stroke:#fb923c,color:#fff;
    classDef decision fill:#27272a,stroke:#a1a1aa,color:#fff;
    class A,F,L,N ok;
    class B,D,G,M,H,I,W,R,U,Z,AA wait;
    class C,E,J,K,Q,V,X,Y,T decision;
```

## 6. Quy tắc cập nhật sơ đồ

Trong cùng commit thay đổi chức năng:

1. Đối chiếu danh sách `pdfTools`, `imageTools` và `utilityTools` trong `src/App.jsx` với mục **Bản đồ chức năng**.
2. Nếu đổi xử lý browser/API, cập nhật **Kiến trúc và luồng dữ liệu**.
3. Nếu đổi preview, validation hoặc kết quả tải xuống, cập nhật **Luồng sử dụng chung**.
4. Nếu đổi CI, Nginx, systemd, deploy, health hoặc rollback, cập nhật **Production, cập nhật và bảo trì**.
5. Kiểm tra Mermaid render được trên GitHub trước khi phát hành.
