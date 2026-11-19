const mongoose = require("mongoose");
const XLSX = require("xlsx");
const Subject = require("../models/Subject");
const Course = require("../models/Course");
const LearningPath = require("../models/LearningPath");
const Class = require("../models/Class");
const Lesson = require("../models/Lesson");
const Coach = require("../models/Coach");
const User = require("../models/User");
const { coachCanTeach } = require("../models/coachSubjects");

const sheets = [
  { group: "courses", name: "Khoa hoc", required: ["Mon", "Ten khoa hoc", "Hoc phi"], optional: ["Mo ta", "Trang thai"] },
  { group: "learningPaths", name: "Lo trinh", required: ["Khoa hoc", "Ten lo trinh"], optional: ["Mo ta"] },
  { group: "classes", name: "Lop hoc", required: ["Ten lop", "Khoa hoc", "Email HLV"], optional: [] },
  { group: "lessons", name: "Bai hoc", required: ["Lop", "Lo trinh", "Thu tu", "Ten bai"], optional: ["Noi dung", "Link video"] },
];
const cellText = value => String(value ?? "").trim();
const key = value => cellText(value).normalize("NFC").toLowerCase();
const headerKey = value => key(value).normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
const same = (left, right) => String(left) === String(right);

function readRows(buffer) {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("Tệp phải có định dạng .xlsx.");
  }
  const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: 1002 });
  const rows = [];
  if (!sheets.some(sheet => workbook.Sheets[sheet.name])) {
    throw new Error("Không tìm thấy sheet dữ liệu. Hãy dùng tệp mẫu.");
  }
  for (const sheet of sheets) {
    const worksheet = workbook.Sheets[sheet.name];
    if (!worksheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    const columns = Math.min(range.e.c, 63);
    if (range.s.c > columns) throw new Error(`Cột dữ liệu không hợp lệ trong sheet ${sheet.name}.`);
    const [headers = [], ...data] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, defval: "", blankrows: true, range: { s: range.s, e: { r: range.e.r, c: columns } },
    });
    if (worksheet["!fullref"]) throw new Error("Tệp tối đa 1000 dòng dữ liệu.");
    if (!data.some(row => row.some(value => cellText(value)))) continue;
    const indices = new Map(headers.map((value, index) => [headerKey(value), index]));
    for (const column of sheet.required) {
      if (!indices.has(headerKey(column))) throw new Error(`Sheet ${sheet.name} thiếu cột "${column}".`);
    }
    data.forEach((row, index) => {
      if (!row.some(value => cellText(value))) return;
      const values = Object.fromEntries([...sheet.required, ...sheet.optional]
        .map(column => [column, cellText(row[indices.get(headerKey(column))])]));
      rows.push({ sheet, number: range.s.r + index + 2, values });
    });
    if (rows.length > 1000) throw new Error("Tệp tối đa 1000 dòng dữ liệu.");
  }
  return rows;
}

function lookup(records, name, label, field = "name") {
  const found = records.filter(record => key(record[field]) === key(name));
  if (found.length > 1) throw new Error(`${label} "${name}" bị trùng tên.`);
  return found[0];
}

function requiredRecord(record, label) {
  if (!record) throw new Error(`Không tìm thấy ${label}.`);
  return record;
}

async function loadCoaches(find) {
  const coaches = await find(Coach);
  const users = await find(User, { _id: { $in: coaches.map(coach => coach.userId) }, role: "COACH" }, "email");
  const emails = new Map(users.map(user => [String(user._id), user.email]));
  return coaches.map(coach => ({ ...coach, email: emails.get(String(coach.userId)) }));
}

async function planImport(rows, dryRun, session) {
  const find = (model, filter = {}, fields) => model.find(filter, fields).session(session).lean();
  const subjects = await find(Subject);
  const courses = await find(Course);
  const paths = await find(LearningPath);
  const classes = await find(Class);
  const lessons = await find(Lesson);
  const coaches = await loadCoaches(find);
  const pending = [];
  const report = {
    dryRun, imported: false, valid: true, rows: [], errors: [],
    summary: Object.fromEntries(sheets.map(({ group }) => [group, { create: 0, skip: 0, error: 0 }])),
  };

  async function stage(Model, records, existing, fields, label) {
    if (existing) return { action: "skip", label };
    const document = new Model(fields);
    await document.validate();
    records.push(document);
    pending.push(document);
    return { action: "create", label };
  }

  const handlers = {
    courses(values) {
      const name = values["Ten khoa hoc"];
      const subject = requiredRecord(lookup(subjects, values.Mon, "Môn"), `môn "${values.Mon}"`);
      const price = Number(values["Hoc phi"]);
      if (!Number.isFinite(price) || price < 0) throw new Error("Học phí phải là số không âm.");
      const existing = lookup(courses, name, "Khóa học");
      if (existing && !same(existing.subjectId, subject._id)) throw new Error("Khóa học đã thuộc môn khác.");
      return stage(Course, courses, existing, {
        name, subjectId: subject._id, price, description: values["Mo ta"],
        status: values["Trang thai"].toUpperCase() || "ACTIVE",
      }, name);
    },
    learningPaths(values) {
      const name = values["Ten lo trinh"];
      const course = requiredRecord(lookup(courses, values["Khoa hoc"], "Khóa học"), `khóa học "${values["Khoa hoc"]}"`);
      const existing = lookup(paths.filter(path => same(path.courseId, course._id)), name, "Lộ trình");
      return stage(LearningPath, paths, existing, { courseId: course._id, name, description: values["Mo ta"] }, name);
    },
    classes(values) {
      const name = values["Ten lop"];
      const course = requiredRecord(lookup(courses, values["Khoa hoc"], "Khóa học"), `khóa học "${values["Khoa hoc"]}"`);
      const existing = lookup(classes, name, "Lớp");
      const coach = requiredRecord(lookup(coaches, values["Email HLV"], "Email HLV", "email"), `HLV "${values["Email HLV"]}"`);
      if (existing && (!same(existing.courseId, course._id) || !same(existing.coachId, coach._id))) {
        throw new Error("Lớp cùng tên đã có khóa học hoặc HLV khác.");
      }
      if (!coachCanTeach(coach, course.subjectId)) throw new Error("HLV không phụ trách môn của khóa học.");
      if (!existing && classes.some(item => same(item.coachId, coach._id))) throw new Error("HLV đã được phân công cho lớp khác.");
      return stage(Class, classes, existing, { name, courseId: course._id, subjectId: course.subjectId, coachId: coach._id }, name);
    },
    lessons(values) {
      const title = values["Ten bai"];
      const classItem = requiredRecord(lookup(classes, values.Lop, "Lớp"), `lớp "${values.Lop}"`);
      const path = requiredRecord(lookup(paths.filter(item => same(item.courseId, classItem.courseId)), values["Lo trinh"], "Lộ trình"), `lộ trình "${values["Lo trinh"]}" của khóa học`);
      const order = Number(values["Thu tu"]);
      if (!Number.isSafeInteger(order) || order < 1) throw new Error("Thứ tự bài học phải là số nguyên dương.");
      const existing = lessons.find(item => same(item.classId, classItem._id) && item.order === order);
      if (existing && (key(existing.title) !== key(title) || !same(existing.learningPathId, path._id))) {
        throw new Error("Thứ tự này đã được dùng cho bài học khác trong lớp.");
      }
      const videoUrl = values["Link video"];
      if (!Lesson.isValidVideoUrl(videoUrl)) throw new Error("Link video phải bắt đầu bằng http:// hoặc https:// và hợp lệ.");
      return stage(Lesson, lessons, existing, {
        classId: classItem._id, learningPathId: path._id, title, order,
        description: values["Noi dung"], videoUrl,
      }, title);
    },
  };

  for (const { sheet, number, values } of rows) {
    const location = { sheet: sheet.name, row: number };
    const summary = report.summary[sheet.group];
    try {
      const missing = sheet.required.find(column => !values[column]);
      if (missing) throw new Error(`Thiếu giá trị cột "${missing}".`);
      const result = await handlers[sheet.group](values);
      summary[result.action]++;
      report.rows.push({ ...location, ...result });
    } catch (error) {
      summary.error++;
      report.errors.push({ ...location, message: error.message });
    }
  }
  report.valid = report.errors.length === 0;
  if (!dryRun && report.valid && pending.length) {
    for (const document of pending) await document.save({ session });
    report.imported = true;
  }
  return report;
}

async function importCatalog(req, res) {
  if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) {
    return res.status(400).json({ success: false, message: "Chọn tệp Excel .xlsx." });
  }
  let rows;
  try {
    rows = readRows(req.file.buffer);
  } catch (error) {
    return res.status(400).json({ success: false, message: `Không thể đọc tệp Excel. ${error.message}` });
  }
  const dryRun = req.query.dryRun === "1";
  try {
    const data = dryRun
      ? await planImport(rows, true, null)
      : await mongoose.connection.transaction(session => planImport(rows, false, session));
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Catalog import error:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Dữ liệu đã thay đổi. Hãy kiểm tra lại tệp." });
    }
    return res.status(500).json({ success: false, message: "Không thể xử lý yêu cầu nhập Excel." });
  }
}

async function downloadTemplate(_req, res) {
  try {
    const [subjects, coaches, coachIds] = await Promise.all([
      Subject.find().lean(),
      loadCoaches((model, filter, fields) => model.find(filter, fields).lean()),
      Class.distinct("coachId"),
    ]);
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[...sheet.required, ...sheet.optional]]), sheet.name);
    }
    const subjectNames = new Map(subjects.map(subject => [String(subject._id), subject.name]));
    const assigned = new Set(coachIds.map(String));
    const guide = [
      ["Nhập dữ liệu theo tên. Có thể để trống sheet không dùng."],
      ["Các môn hiện có"], ...subjects.map(subject => [subject.name]), [],
      ["Email HLV chưa có lớp", "Họ tên", "Môn"],
      ...coaches.filter(coach => coach.email && !assigned.has(String(coach._id)))
        .map(coach => [coach.email, coach.fullName, subjectNames.get(String(coach.subjectIds?.[0]))]),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), "Huong dan");
    return res.attachment("mau-nhap-khoa-hoc.xlsx").send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  } catch (error) {
    console.error("Catalog template error:", error.message);
    return res.status(500).json({ success: false, message: "Không thể tạo tệp mẫu." });
  }
}

module.exports = { downloadTemplate, importCatalog };
