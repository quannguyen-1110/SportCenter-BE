const Class = require("../models/Class");
const ClassRegistration = require("../models/ClassRegistration");

async function coachCanAccessMember(coachId, memberId, classId = null) {
  const classes = await Class.find({ coachId, ...(classId ? { _id: classId } : {}) }).select("_id");
  return Boolean(await ClassRegistration.exists({
    classId: { $in: classes.map(item => item._id) }, memberId, status: "CONFIRMED",
  }));
}

async function coachTrainingScope(coachId) {
  const classes = await Class.find({ coachId }).select("_id");
  const classIds = classes.map(row => row._id);
  const memberIds = await ClassRegistration.distinct("memberId", { classId: { $in: classIds }, status: "CONFIRMED" });
  return { $or: [{ classId: { $in: classIds } }, { memberId: { $in: memberIds } }] };
}
module.exports = { coachCanAccessMember, coachTrainingScope };
