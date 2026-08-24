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
    C -->|"Trong browser"| B["🧠 PDF.js / Canvas / AI model"]
    C -->|"API nội bộ"| A["📤 Multipart /api/tools"]

    B --> B1["Nén PDF đặt MB"]
    B --> B2["Xóa phông AI"]
    B --> B3["Preview PDF / khung cắt"]

    A --> G["🛡️ 50 MB · 500 trang · 2 tác vụ đồng thời"]
    G --> I["🖼️ Sharp · xử lý ảnh"]
    G --> D["📄 pdf-lib · PDF / ZIP"]
    G --> O["📝 DOCX / XLSX / PPTX / TXT"]

    B1 --> X["✅ Preview kết quả"]
    B2 --> X
    I --> X
    D --> X
    O --> X
    X --> T["⬇️ Tải tệp về máy"]

    classDef edge fill:#075985,stroke:#38bdf8,color:#fff;
    classDef browser fill:#4338ca,stroke:#a5b4fc,color:#fff;
    classDef server fill:#166534,stroke:#4ade80,color:#fff;
    classDef result fill:#9a3412,stroke:#fb923c,color:#fff;
    class U,N,S edge;
    class R,P,C,B,B1,B2,B3 browser;
    class E,A,G,I,D,O server;
    class X,T result;
```

Tệp được xử lý trong bộ nhớ hoặc trong browser. Luồng hiện tại không tạo kho lưu trữ tệp người dùng lâu dài.

## 2. Bản đồ chức năng

```mermaid
flowchart TB
    ROOT["PDFTools · 15 công cụ"]
    ROOT --> PDF["📄 9 công cụ PDF"]
    ROOT --> IMG["🖼️ 6 công cụ ảnh"]

    PDF --> PE["Chỉnh sửa PDF<br/>chữ · watermark · số trang"]
    PDF --> PC["Nén PDF<br/>đặt MB / không mất dữ liệu"]
    PDF --> PM["Ghép PDF<br/>kéo thứ tự · xoay · chèn"]
    PDF --> PO["Sắp xếp PDF<br/>kéo-thả · nhân bản · xóa"]
    PDF --> PS["Tách PDF<br/>chọn thumbnail · xuất ZIP"]
    PDF --> PW["PDF sang Word"]
    PDF --> PX["PDF sang Excel"]
    PDF --> PP["PDF sang PowerPoint"]
    PDF --> PT["PDF sang văn bản"]

    IMG --> IR["Xóa phông nền<br/>AI trong browser"]
    IMG --> IC["Chuyển đổi định dạng<br/>JPG / PNG / WebP / AVIF"]
    IMG --> IZ["Thay đổi kích thước"]
    IMG --> IK["Cắt ảnh<br/>khung kéo-thả"]
    IMG --> IN["Nén ảnh"]
    IMG --> IE["Chỉnh sửa ảnh<br/>màu · xoay · lật"]

    classDef root fill:#312e81,stroke:#a5b4fc,color:#fff;
    classDef pdf fill:#075985,stroke:#38bdf8,color:#fff;
    classDef image fill:#166534,stroke:#4ade80,color:#fff;
    class ROOT root;
    class PDF,PE,PC,PM,PO,PS,PW,PX,PP,PT pdf;
    class IMG,IR,IC,IZ,IK,IN,IE image;
```

## 3. Luồng sử dụng chung

```mermaid
flowchart LR
    A["Chọn công cụ"] --> B["Kéo-thả hoặc chọn tệp"]
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

## 4. Production, cập nhật và bảo trì

```mermaid
flowchart TD
    S["setup-ubuntu.sh"] --> Q{"apt đang bị khóa?"}
    Q -- "Có" --> W["Chờ an toàn tối đa 10 phút"]
    W --> Q
    Q -- "Không" --> A["Release cũ đang phục vụ"]
    A --> B["Build release mới độc lập"]
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
    class B,D,G,M,H,I,W wait;
    class C,E,J,K,Q decision;
```

## 5. Quy tắc cập nhật sơ đồ

Trong cùng commit thay đổi chức năng:

1. Đối chiếu danh sách `pdfTools` và `imageTools` trong `src/App.jsx` với mục **Bản đồ chức năng**.
2. Nếu đổi xử lý browser/API, cập nhật **Kiến trúc và luồng dữ liệu**.
3. Nếu đổi preview, validation hoặc kết quả tải xuống, cập nhật **Luồng sử dụng chung**.
4. Nếu đổi CI, Nginx, systemd, deploy, health hoặc rollback, cập nhật **Production, cập nhật và bảo trì**.
5. Kiểm tra Mermaid render được trên GitHub trước khi phát hành.
