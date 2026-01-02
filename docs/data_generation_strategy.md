# Chiến lược Sinh Dữ liệu Sách (Data Generation Strategy)

Tài liệu này mô tả chi tiết cách thức sinh 1.000+ đầu sách để đảm bảo tính thực tế, phục vụ cho việc thống kê, phân loại và tìm kiếm trong hệ thống e-Library 3 thành phố.

## 1. Tổng quan Phân phối (Distribution Overview)

Chúng ta sẽ sinh tổng cộng **1.000 đầu sách (Books)**.

### 1.1 Phân phối theo Định dạng (Format)
Để kiểm thử các trường hợp nghiệp vụ (Mượn bản giấy, Đọc online, hoặc cả hai):

| Loại sách | Tỷ lệ | Số lượng | Mô tả |
| :--- | :--- | :--- | :--- |
| **Hybrid (Lai)** | **50%** | 500 | Có cả bản cứng (Physical) và bản mềm (Digital). |
| **Physical Only** | **30%** | 300 | Chỉ có bản cứng (Sách cũ, sách hiếm, truyện tranh giấy). |
| **Digital Only** | **20%** | 200 | Chỉ có bản mềm (E-book mới, tài liệu số). |

### 1.2 Phân phối theo Địa lý (Physical Availability)
*Áp dụng cho 800 đầu sách có bản cứng (Hybrid + Physical Only)*

Hệ thống mô phỏng thực tế kho sách không đồng đều giữa các chi nhánh:

| Phạm vi | Tỷ lệ | Mô tả |
| :--- | :--- | :--- |
| **Toàn quốc (3 điểm)** | **40%** | Sách có mặt tại cả HN, HP, DN (Sách giáo khoa, Best seller). |
| **Khu vực (2 điểm)** | **30%** | Random tổ hợp: (HN+HP), (HN+DN), hoặc (HP+DN). |
| **Độc quyền (1 điểm)** | **30%** | Chỉ có tại 1 nơi duy nhất (Sách địa phương hoặc sách hiếm). |

---

## 2. Chiến lược Chủ đề (Categories & Subjects)

Đây là phần quan trọng để phục vụ **Thống kê (Dashboard)** và **Tìm kiếm (Search)**. Thay vì dùng random text, chúng ta sẽ xây dựng một **Bộ từ điển Chủ đề (Taxonomy)** cố định.

### 2.1 Hệ thống Phân loại (Taxonomy) - Chuẩn LCC (Library of Congress Classification)
Chúng ta sẽ sử dụng hệ thống phân loại chuẩn quốc tế **LCC** để gán chủ đề cho sách. Thay vì các tên chủ đề tự do, mỗi cuốn sách sẽ có `subject` hoặc `lcc_code` tương ứng.

Dưới đây là các nhóm chính (Classes) và lớp con (Subclasses) quan trọng sẽ được sử dụng trong tập dữ liệu 1.000 cuốn sách:

#### **A – Tác phẩm tổng quát (General Works)**
*   **AE:** Bách khoa toàn thư (Encyclopedias)
*   **AI:** Chỉ mục (Indexes)

#### **B – Triết học, Tâm lý học, Tôn giáo**
*   **B:** Triết học (Philosophy)
*   **BF:** Tâm lý học (Psychology - *Rất phổ biến*)
*   **BL:** Tôn giáo
*   **BJ:** Đạo đức học

#### **C, D, E, F – Lịch sử (History)**
*   **DS:** Lịch sử Châu Á (bao gồm **DS556**: Việt Nam)
*   **D:** Lịch sử thế giới
*   **E:** Lịch sử Hoa Kỳ

#### **G – Địa lý, Nhân chủng, Giải trí**
*   **G:** Địa lý & Bản đồ
*   **GN:** Nhân chủng học
*   **GV:** Thể thao & Giải trí

#### **H – Khoa học Xã hội (Social Sciences)**
*   **HB:** Kinh tế học (Economic Theory)
*   **HD:** Công nghiệp & Quản trị
*   **HF:** Thương mại & Kinh doanh (Commerce)
*   **HG:** Tài chính & Ngân hàng (Finance)
*   **HM:** Xã hội học (Sociology)

#### **J, K – Chính trị & Luật pháp**
*   **JA:** Khoa học chính trị
*   **K:** Luật pháp (Law)
*   **KH:** Luật Việt Nam & Châu Á

#### **L – Giáo dục (Education)**
*   **L:** Giáo dục (Chung)
*   **LB:** Lý thuyết & Thực hành giáo dục
*   **LC:** Các khía cạnh đặc biệt của giáo dục

#### **M – Âm nhạc (Music)**
*   **M:** Bản nhạc (Scores)
*   **ML:** Văn học âm nhạc (Lịch sử, phê bình)

#### **N – Mỹ thuật (Fine Arts)**
*   **N:** Nghệ thuật thị giác
*   **NA:** Kiến trúc (Architecture)
*   **NB:** Điêu khắc
*   **ND:** Hội họa (Painting)
*   **NK:** Nghệ thuật trang trí

#### **P – Ngôn ngữ và Văn học (Language & Literature)**
*   **PL:** Văn học phương Đông (bao gồm Văn học Việt Nam)
*   **PR:** Văn học Anh
*   **PS:** Văn học Mỹ
*   **PZ:** Sách thiếu nhi (Fiction & Juvenile)

#### **Q – Khoa học Tự nhiên (Science)**
*   **QA:** Toán học & **Khoa học máy tính (QA76)**
*   **QC:** Vật lý
*   **QD:** Hóa học
*   **QH:** Sinh học

#### **R – Y học (Medicine)**
*   **R:** Y học (Chung)
*   **RA:** Y tế công cộng
*   **RC:** Nội khoa
*   **RJ:** Nhi khoa
*   **RM:** Dược lý & Trị liệu

#### **S – Nông nghiệp (Agriculture)**
*   **S:** Nông nghiệp (Chung)
*   **SB:** Trồng trọt
*   **SF:** Chăn nuôi

#### **T – Công nghệ (Technology)**
*   **T:** Công nghệ chung
*   **TA:** Kỹ thuật xây dựng
*   **TK:** Kỹ thuật điện, Viễn thông & **Phần cứng máy tính**
*   **TP:** Công nghệ hóa học
*   **TX:** Đời sống & Nấu ăn (Home Economics)

#### **U, V – Quân sự & Hải quân**
*   **U:** Khoa học quân sự
*   **V:** Khoa học hải quân

#### **Z – Thư mục & Thư viện**
*   **Z:** Khoa học thư viện & Thông tin


### 2.2 Quy tắc Gán Chủ đề
Mỗi cuốn sách trong file `books_1k.json` sẽ được gán:
1.  **LCC Code**: Ví dụ `QA76.73.J38`.
2.  **Major Class**: Ví dụ "Q - Khoa học Tự nhiên".
3.  **Subject Keywords**: Ví dụ `["Computer Science", "Java", "Programming"]`.

Việc này giúp hệ thống tìm kiếm (Search) hoạt động thông minh:
*   Tìm "Công nghệ": Quét các sách nhóm **T**.
*   Tìm "Kinh tế": Quét các sách nhóm **H**.


### 2.3 Mục đích sử dụng
*   **Dashboard**: Vẽ biểu đồ tròn "Cơ cấu kho sách theo chủ đề".
*   **Search**: Demo Full-text search tìm "Java" sẽ ra sách thuộc chủ đề "Computer Science" hoặc "Software Engineering".
*   **Suggestion**: Gợi ý "Sách cùng chủ đề".

---

## 3. Quy tắc Sinh Dữ liệu Chi tiết

### 3.1 Nguồn dữ liệu
### 3.1 Nguồn dữ liệu
*   **10.000 Sách (Mô phỏng như thật)**: 
    *   Do số lượng 10.000 là khá lớn để nạp từ thủ công, chúng ta sẽ dùng chiến lược **"Real Patterns"** (Khuôn mẫu thực tế).
    *   **Nhóm VN (Ưu tiên)**: Với các mã LCC liên quan Việt Nam (DS556, PL, KH), sẽ sinh tên sách theo khuôn mẫu luật, văn học, lịch sử Việt Nam thực tế (Ví dụ: "Đại Việt Sử Ký Toàn Thư", "Luật Dân sự 2015", "Thơ Xuân Diệu").
    *   **Nhóm Quốc tế**: Sử dụng danh sách Top 1000 sách kinh điển (IT, Science, Fiction) và nhân bản có biến thể (Volume, Edition) để đạt 10.000.
    *   **Tỷ lệ**: Tăng cường sách Việt Nam lên 40%-50% trong tổng số.


### 3.2 Logic Số lượng Bản in (Inventory)
*   **Sách phổ biến (Toàn quốc)**: Mỗi chi nhánh có 10-20 bản.
*   **Sách hiếm (Độc quyền)**: Chi nhánh sở hữu chỉ có 1-3 bản.
*   $\rightarrow$ Tổng số lượng `physical_copies` dự kiến: ~4.000 - 5.000 bản.

### 3.3 Logic E-book
*   **Vendor**: Random các nxb lớn (Kim Đồng, NXB Trẻ, O'Reilly, Springer).
*   **Concurrency**:
    *   Sách giáo khoa/Tài liệu tham khảo: `UNLIMITED`.
    *   Sách Hot: `CONCURRENT_USER` (Giới hạn 3-5 người đọc cùng lúc).

---

## 4. Kế hoạch Triển khai Script

File `scripts/seed.js` sẽ thực hiện các bước:

1.  **Vệ sinh**: Xóa sạch dữ liệu cũ (`dropDatabase` hoặc `deleteMany`).
2.  **Bước 1 - Tạo Reference Data**: Tạo danh sách 18 chủ đề, 3 chi nhánh.
3.  **Bước 2 - Sinh Books**: Loop 1.000 lần.
    *   Chọn chủ đề trước.
    *   Sinh tên sách dựa trên chủ đề.
    *   Quyết định Format (Hybrid/Phys/Dig).
4.  **Bước 3 - Sinh Inventory (Copies/Licenses)**:
    *   Dựa trên Format và Region rule đã định nghĩa ở mục 1.
    *   Tạo bản ghi vào `physical_copies` và `digital_licenses`.
5.  **Bước 4 - Sinh Members**: 1.000 thành viên phân bổ theo tỷ trọng dân số giả lập (HN: 50%, HP: 25%, DN: 25%).
6.  **Bước 5 - Sinh Events/Loans**:
    *   Mô phỏng 5.000 giao dịch mượn trả trong quá khứ (1 năm trở lại).
    *   Đảm bảo logic: Có sách thì mới mượn được.
