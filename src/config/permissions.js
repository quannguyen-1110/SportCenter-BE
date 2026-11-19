// Access matrix for each role. Route guards (roleMiddleware) enforce it;
// this list documents it for the manager's permission screen.
const roles = [
  {
    role: "CENTER_MANAGER",
    name: "Quản lý trung tâm",
    permissions: [
      "Quản lý hội viên, huấn luyện viên, nhân viên",
      "Quản lý lớp học, bộ môn, phòng tập, lịch học",
      "Phân công huấn luyện viên cho lớp",
      "Quản lý gói hội viên, học phí, thời hạn",
      "Xem báo cáo hội viên, đăng ký lớp, doanh thu",
      "Đổi vai trò và khóa/mở khóa tài khoản",
      "Xem lịch sử thao tác",
    ],
  },
  {
    role: "COACH",
    name: "Huấn luyện viên",
    permissions: [
      "Xem lịch dạy và học viên các lớp phụ trách",
      "Tạo kế hoạch tập, ghi kết quả, nhận xét",
      "Điểm danh học viên theo buổi",
      "Gửi thông báo và bài tập về nhà cho học viên",
      "Dùng AI gợi ý bài tập",
    ],
  },
  {
    role: "RECEPTIONIST",
    name: "Lễ tân",
    permissions: [
      "Tìm kiếm, đăng ký hội viên tại quầy",
      "Đăng ký/gia hạn gói, kiểm tra thời hạn gói",
      "Check-in hội viên, đăng ký/hủy lớp hộ",
      "Ghi nhận thanh toán, in hóa đơn",
      "Tiếp nhận yêu cầu hỗ trợ",
    ],
  },
  {
    role: "MEMBER",
    name: "Hội viên",
    permissions: [
      "Cập nhật hồ sơ cá nhân",
      "Đăng ký/gia hạn gói tập, đăng ký/hủy lớp",
      "Xem lịch tập, điểm danh, kết quả và kế hoạch tập",
      "Hỏi trợ lý AI, nhận thông báo",
    ],
  },
];

module.exports = { roles };
