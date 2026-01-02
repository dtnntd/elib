/**
 * DATA PATTERNS & TAXONOMY FOR E-LIBRARY SEEDING
 */

const LCC_CLASSES = {
    // --- VIETNAM & ASIA SPECIFIC (Priority) ---
    "DS": { code: "DS", name: "Lịch sử Châu Á", topics: ["Lịch sử Việt Nam", "Văn hóa Đông Nam Á", "Chiến tranh Đông Dương", "Sài Gòn xưa", "Hà Nội 36 phố phường"] },
    "PL": { code: "PL", name: "Ngôn ngữ & Văn học Phương Đông", topics: ["Văn học Việt Nam", "Truyện Kiều", "Thơ mới", "Văn học hiện đại", "Ca dao tục ngữ"] },
    "KH": { code: "KH", name: "Luật pháp Châu Á (Việt Nam)", topics: ["Luật Dân sự", "Luật Hình sự", "Luật Đất đai", "Luật Doanh nghiệp", "Hiến pháp"] },
    // Major Classes A-Z
    "A": { code: "A", name: "Tác phẩm tổng quát", topics: ["Encyclopedia", "General Knowledge", "Almanac"] },
    "B": { code: "B", name: "Triết học & Tâm lý", topics: ["Philosophy", "Psychology", "Ethics", "Logic"] },
    "H": { code: "H", name: "Khoa học Xã hội", topics: ["Economics", "Finance", "Sociology", "Business"] },
    "K": { code: "K", name: "Luật pháp", topics: ["International Law", "Civil Rights", "Legal Theory"] },
    "M": { code: "M", name: "Âm nhạc", topics: ["Music Theory", "Classical Music", "Jazz"] },
    "N": { code: "N", name: "Mỹ thuật", topics: ["Painting", "Architecture", "Sculpture"] },
    "P": { code: "P", name: "Ngôn ngữ & Văn học", topics: ["Linguistics", "Fiction", "Poetry", "Drama"] },
    "Q": { code: "Q", name: "Khoa học Tự nhiên", topics: ["Mathematics", "Physics", "Chemistry", "Biology", "Computer Science"] },
    "R": { code: "R", name: "Y học", topics: ["Medicine", "Public Health", "Pharmacy"] },
    "S": { code: "S", name: "Nông nghiệp", topics: ["Agriculture", "Forestry", "Fisheries"] },
    "T": { code: "T", name: "Công nghệ", topics: ["Engineering", "Chemical Technology", "Electronics", "IT"] },
    "U": { code: "U", name: "Khoa học Quân sự", topics: ["Military Strategy", "Defense"] },
    "V": { code: "V", name: "Khoa học Hải quân", topics: ["Naval Science", "Maritime History"] },
    "Z": { code: "Z", name: "Khoa học Thư viện", topics: ["Bibliography", "Library Science", "Information Science"] }
};

const REAL_TITLES_VN = [
    // --- VĂN HỌC KINH ĐIỂN & HIỆN ĐẠI ---
    "Truyện Kiều", "Lục Vân Tiên", "Số Đỏ", "Dế Mèn Phiêu Lưu Ký", "Đất Rừng Phương Nam",
    "Tuổi Thơ Dữ Dội", "Vang Bóng Một Thời", "Chí Phèo", "Lão Hạc", "Tắt Đèn",
    "Đời Thừa", "Sống Mòn", "Giông Tố", "Bỉ Vỏ", "Cánh Đồng Bất Tận",
    "Mắt Biếc", "Tôi Thấy Hoa Vàng Trên Cỏ Xanh", "Cho Tôi Xin Một Vé Đi Tuổi Thơ", "Cô Gái Đến Từ Hôm Qua",
    "Nỗi Buồn Chiến Tranh", "Mùa Lạc", "Vợ Nhặt", "Rừng Xà Nu", "Chiếc Thuyền Ngoài Xa",
    "Hồn Trương Ba Da Hàng Thịt", "Đảo Hoang", "Tuổi 20 Yêu Dấu", "Vừa Nhắm Mắt Vừa Mở Cửa Sổ",
    "Quân Khu Nam Đồng", "Ăn Cơm Mới", "Thương Nhớ Mười Hai", "Hà Nội Băm Sáu Phố Phường",

    // --- LỊCH SỬ & VĂN HÓA ---
    "Đại Việt Sử Ký Toàn Thư", "Việt Nam Sử Lược", "Lịch Triều Hiến Chương Loại Chí",
    "Quốc Triều Hình Luật", "Hồ Chí Minh Toàn Tập", "Nhật Ký Trong Tù", "Tuyên Ngôn Độc Lập",
    "Hào Khí Đông A", "Sử Việt - 12 Khúc Tráng Ca", "Biên Bản Chiến Tranh 1-2-3-4.75",
    "Đại Nam Thực Lục", "Hoàng Lê Nhất Thống Chí", "Văn Minh Việt Nam", "Người Việt Cao Quý",
    "Ngàn Năm Áo Mũ", "Đất Lề Quê Thói", "Làng Xã Việt Nam", "Văn Hóa Tộc Người Việt Nam",

    // --- LUẬT & CHÍNH TRỊ ---
    "Luật Dân Sự 2015", "Luật Đất Đai 2024", "Luật Doanh Nghiệp 2020", "Luật Hôn Nhân và Gia Đình",
    "Luật Hình Sự", "Luật Lao Động", "Hiến Pháp Nước CHXHCN Việt Nam", "Luật Thương Mại",
    "Giáo Trình Lý Luận Nhà Nước và Pháp Luật", "Tư Tưởng Hồ Chí Minh", "Lịch Sử Đảng Cộng Sản Việt Nam",

    // --- KINH TẾ & KỸ NĂNG ---
    "Cà Phê Cùng Tony", "Trên Đường Băng", "Tuổi Trẻ Đáng Giá Bao Nhiêu", "Nhà Giả Kim (Bản tiếng Việt)",
    "Đắc Nhân Tâm (Bản tiếng Việt)", "Quốc Gia Khởi Nghiệp (Bản tiếng Việt)", "Hành Trình Về Phương Đông",
    "Muôn Kiếp Nhân Sinh", "Dám Bị Ghét", "Lối Sống Tối Giản Của Người Nhật",
    "Kinh Tế Học Vui Vẻ", "Tâm Lý Học Tội Phạm", "Thấu Hiểu Tiếp Thị Từ A Đến Z"
];

const VN_NAMES = {
    first: ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"],
    mid: ["Văn", "Thị", "Đức", "Thành", "Minh", "Hoài", "Quang", "Ngọc", "Thanh", "Hữu", "Xuân", "Thu"],
    last: ["An", "Bình", "Cường", "Dũng", "Em", "Giang", "Hải", "Hùng", "Hương", "Khánh", "Lan", "Long", "Nam", "Nga"]
};

const PUBLISHERS = ["NXB Kim Đồng", "NXB Trẻ", "NXB Văn Học", "NXB Chính Trị Quốc Gia", "NXB Giáo Dục", "Nhã Nam", "Alpha Books", "O'Reilly", "Pearson", "Springer"];

module.exports = { LCC_CLASSES, REAL_TITLES_VN, VN_NAMES, PUBLISHERS };
