# Chiến Lược Triển Khai (Deployment Strategy) - Go + React

Để đảm bảo việc deploy dễ dàng ("One Command Deploy") và tận dụng sức mạnh của Docker, chúng ta sẽ sử dụng chiến lược **Multi-stage Build**.

## 1. Kiến trúc Docker mới

Chúng ta sẽ thêm 2 services vào file `docker-compose.yaml`:
*   `api-server`: Chạy Backend Go (đồng thời serve static files của React).
*   (Optionally) `web-dev`: Chạy React ở chế độ Hot-reload (chỉ dùng lúc code, không dùng lúc deploy thật).

## 2. Quy trình Build "All-in-One" (Dockerfile Production)

File `Dockerfile` sẽ làm 2 việc cùng lúc:

1.  **Stage 1: Build Frontend (Node.js)**
    *   Kéo image `node:18-alpine`.
    *   Copy source React -> Chạy `npm install` -> `npm run build`.
    *   Kết quả: Có thư mục `/dist` chứa web tĩnh.

2.  **Stage 2: Build Backend (Golang)**
    *   Kéo image `golang:1.21-alpine`.
    *   Copy source Go -> Build ra file binary `main`.

3.  **Stage 3: Final Image (Alpine Linux - Siêu nhẹ)**
    *   Copy file binary `main` từ Stage 2.
    *   Copy thư mục `/dist` từ Stage 1.
    *   Chạy app.

=> **Kết quả:** Bạn chỉ cần 1 Image duy nhất (~30MB) chứa cả Web lẫn API.

## 3. Cấu trúc thư mục

```text
/final/
├── docker-compose.yaml    (Update thêm service app)
├── server/                (Code Go - API)
│   ├── main.go
│   ├── Dockerfile         (Dev mode)
│   └── ...
├── web/                   (Code React)
│   ├── package.json
│   ├── vite.config.js
│   └── ...
└── Dockerfile.prod        (File build gộp để deploy server)
```

## 4. Kế hoạch thực hiện

1.  **Phase 1: Init Project**
    *   Tạo folder `server` -> Init Go module.
    *   Tạo folder `web` -> Init React Vite.
2.  **Phase 2: Docker Dev Environment**
    *   Update `docker-compose.yaml` để chạy được cả Go và React song song lúc code.
3.  **Phase 3: Coding API & UI**
    *   (Phần này ta sẽ làm chi tiết chức năng).
4.  **Phase 4: Docker Production**
    *   Viết `Dockerfile.prod` để đóng gói cuối cùng.

Bạn đồng ý chiến lược này chứ? Tôi sẽ bắt đầu **Phase 1: Init Project** ngay bây giờ!
