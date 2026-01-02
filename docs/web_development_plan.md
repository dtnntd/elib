# Kế hoạch & Chi Tiết Nghiệp Vụ Hệ Thống E-Library

Tài liệu này mô tả chi tiết các luồng nghiệp vụ (Business Flows) và quy tắc logic (Business Rules) cần triển khai cho hệ thống.

---

## 1. Phân Quyền & Vai Trò (Roles & Permissions)

Hệ thống có 3 loại tài khoản chính:

*   **MEMBER (Thành viên)**:
    *   Tìm kiếm sách.
    *   Mượn sách (theo gói đăng ký).
    *   Xem lịch sử, quản lý tài khoản cá nhân.
*   **STAFF (Thủ thư/Nhân viên chi nhánh)**:
    *   Thuộc về 1 chi nhánh cụ thể (BranchId).
    *   Xử lý mượn/trả sách tại quầy cho thành viên.
    *   Quản lý kho sách (Nhập kho/Hủy sách) tại chi nhánh của mình.
*   **ADMIN (Quản trị viên Hệ thống)**:
    *   Quản lý toàn bộ user (Nâng cấp VIP).
    *   Xem báo cáo thống kê toàn hệ thống.
    *   Cấu hình hệ thống.

---

## 2. Nghiệp Vụ Quản Lý Thành Viên & G gói Cước (Subscription)

Dữ liệu thành viên phải bao gồm trạng thái gói cước. Mọi hành động mượn sách đều phải qua bộ lọc kiểm tra (Validate) này.

### Quy Tắc Gói Cước (Business Rules)

| Tính năng | Gói **BASIC** | Gói **VIP** |
| :--- | :--- | :--- |
| **Trạng thái Sub** | Phải là `active: true` mới được mượn. | Phải là `active: true` mới được mượn. |
| **Số lượng mượn tối đa** | Tối đa **3** cuốn cùng lúc. | Tối đa **10** cuốn cùng lúc. |
| **Thời gian mượn** | **14 ngày**. | **30 ngày**. |
| **Gia hạn (Renew)** | Không được gia hạn. | Được gia hạn 1 lần (+7 ngày). |
| **Quyền truy cập Số** | Chỉ được xem Preview. | Được đọc Full E-book. |

**Luồng Xử Lý (Flow):**
1.  **Check 0**: (Không có chế độ Ban nick).
2.  **Check 1**: `subscription.active` có phải là `true` không?
    *   Nếu `false` -> **Chuyển hướng (Redirect)** sang trang "Gia hạn Gói cước" (Chọn gói Basic/VIP -> Thanh toán Online hoặc Ra quầy).
    *   Hệ thống không cho mượn tiếp cho đến khi gia hạn thành công.
3.  **Check 2**: Đếm số sách đang mượn (`status: "BORROWED"`). Nếu >= Max Limit của plan -> Chặn.

---

## 3. Nghiệp Vụ Quản Lý Tài Liệu (Catalog & Format Logic)

Hệ thống hỗ trợ 2 định dạng tài liệu với quy trình xử lý khác nhau hoàn toàn:

### A. Sách Giấy (Physical Book) - Gắn liền với Chi Nhánh
*   **Cấu trúc**: Mỗi đầu sách (`books`) có nhiều bản sao (`physical_copies`).
*   **Địa điểm**: Bản sao nằm ở chi nhánh nào (`branchId`) thì chỉ được mượn tại chi nhánh đó.
*   **Luồng Mượn**:
    1.  Thành viên chọn sách -> Hệ thống check kho tại các nhánh.
    2.  Thành viên đến quầy -> Staff quét mã sách + mã thành viên.
    3.  Hệ thống đổi trạng thái copy: `AVAILABLE` -> `BORROWED`.
    4.  Tạo record `loans`.
*   **Luồng Trả**:
    1.  Thành viên mang sách đến quầy.
    2.  Staff check tình trạng sách (Rách/Mất?).
    3.  Hệ thống đổi trạng thái copy: `BORROWED` -> `AVAILABLE` (hoặc `LOST`).
    4.  Đóng record `loans` (update `returnedAt`), tính phí phạt nếu quá hạn.

### B. Sách Điện Tử (E-Book/Digital) - Global
*   **Cấu trúc**: Không giới hạn bản sao vật lý. Quản lý bằng `digital_licenses` hoặc quyền truy cập trực tiếp.
*   **Địa điểm**: Truy cập mọi lúc mọi nơi (Cloud).
*   **Luồng Mượn**:
    1.  Member bấm "Đọc ngay" (hoặc "Mượn số").
    2.  Hệ thống check quyền (Có phải VIP không?).
    3.  Tạo record `loans` (Loại `EBOOK`).
    4.  Trả về URL đọc sách (Token truy cập có thời hạn).
*   **Luồng Trả**:
    1.  Tự động "hết hạn" (hủy token) khi đến ngày `dueDate`.
    2.  Member cũng có thể bấm "Trả sớm" để giải phóng slot mượn.

### C. Xử Lý Phạt & Thanh Toán (Financial Logic)
*   **Trường hợp phát sinh tiền**:
    *   Thành viên Mất sách / Làm hỏng sách -> Phạt tiền (Fine).
    *   Thành viên Gia hạn gói cước -> Thu phí đăng ký.
*   **Cấu trúc dữ liệu**:
    *   `members` thêm field `walletBalance` (Số dư ví).
    *   Thêm collection `transactions` (Lịch sử giao dịch):
        ```json
        { "memberId": "...", "type": "FINE_PAYMENT" | "SUBSCRIPTION_FEE", "amount": 50000, "status": "COMPLETED", "refId": "loanId..." }
        ```
    *   Collection `loans` thêm field: `fineAmount`, `isPaid` (Đã nộp phạt chưa?).
*   **Luồng Thanh Toán**:
    *   **Tại quầy**: Member đưa tiền mặt -> Staff tạo Transaction "Đã thu tiền" -> Hệ thống gạch nợ (update `isPaid: true`).
    *   **Online**: (Mô phỏng) Member bấm "Nộp phạt qua VNPAY" -> Hệ thống tạo Transaction thành công -> Gạch nợ.

---

## 4. Đặc tả API & Web Modules (Web Dev Specs)

Dựa trên nghiệp vụ trên, ta xây dựng các màn hình và API sau:

### Module Admin/Staff Portal
*   **Màn hình Quản lý User**:
    *   API: `GET /users` (Filter by Branch/Role).
    *   Action: Nút "Upgrade VIP/Renew Subscription".
*   **Màn hình Mượn Trả Tại Quầy (POS)**:
    *   Giao diện nhập `Member ID`, sau đó nhập list `Book Copy ID`.
    *   API: `POST /circulation/checkout` (Xử lý transaction mượn nhiều sách 1 lúc).

### Module Member Portal
*   **Trang Chi Tiết Sách**:
    *   Hiển thị 2 tab: "Sách Giấy" (Hiện danh sách các nhánh còn hàng) và "E-book" (Nút đọc online).
    *   Logic Show/Hide: Nếu `Basic` mà bấm E-book hoặc hết hạn Sub -> Hiện Pop-up hướng dẫn gia hạn/nâng cấp.
*   **Trang Cá Nhân (My Profile)**:
    *   Hiển thị Badge "BASIC" hoặc "VIP".
    *   Progress Bar: "Bạn đang mượn 2/3 cuốn".

---

## � Cập Nhật Lộ Trình Triển Khai

1.  **Phase 1: Database & Auth (Done database, Next: Auth API)**
    *   Cài đặt JWT, Middleware phân quyền (Admin/Staff/Member).
2.  **Phase 2: Book Catalog & Branch Logic**
    *   Hiển thị sách theo nhánh.
    *   Phân biệt hiển thị cho Sách giấy vs E-book.
3.  **Phase 3: Subscription Enforcement (Quan trọng)**
    *   Viết logic chặn mượn nếu hết hạn Sub hoặc quá limit.
4.  **Phase 4: Circulation Flows**
    *   API Mượn/Trả.

Bạn có đồng ý với bản nghiệp vụ chi tiết này không? Nếu OK, mình sẽ bắt đầu code **Phase 1: Auth & Roles** ngay.
