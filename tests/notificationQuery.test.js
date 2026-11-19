const { test } = require("node:test");
const assert = require("node:assert/strict");
const { notificationFilter } = require("../src/utils/notificationQuery");

test("notification list filters by sender", () => {
  assert.deepEqual(notificationFilter({ sentBy: "me" }, "u1"), { sentBy: "u1" });
  assert.deepEqual(notificationFilter({ sentBy: "system" }, "u1"), { sentBy: null });
  assert.deepEqual(notificationFilter({}, "u1"), {});
  // Unknown values and someone else's id do not narrow (or widen) the list in a surprising way.
  assert.deepEqual(notificationFilter({ sentBy: "6afdd4bae4eeb00a84acac72" }, "u1"), {});
  assert.deepEqual(notificationFilter(undefined, "u1"), {});
});
