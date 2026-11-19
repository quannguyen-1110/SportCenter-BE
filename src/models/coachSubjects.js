const mongoose = require("mongoose");
const Subject = require("./Subject");

const coachCanTeach = (coach, subjectId) => Boolean(subjectId) &&
  Array.isArray(coach.subjectIds) && coach.subjectIds.length === 1 &&
  coach.subjectIds.some(id => String(id) === String(subjectId));

const validateSubjectIds = async (value) => {
  if (!Array.isArray(value) || value.length !== 1 ||
      typeof value[0] !== "string" || !mongoose.isValidObjectId(value[0])) {
    return { valid: false, status: 400, message: "subjectIds must be an array containing exactly one valid subject ID" };
  }
  const subjectId = value[0].toLowerCase();
  if (!await Subject.findById(subjectId)) {
    return { valid: false, status: 404, message: "Subject not found" };
  }
  return { valid: true, subjectIds: [subjectId] };
};

module.exports = { coachCanTeach, validateSubjectIds };
