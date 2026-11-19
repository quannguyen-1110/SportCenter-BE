// Query rules for GET /api/notifications (manager / receptionist), kept pure for tests.

/**
 * Mongo filter from the query string:
 * - sentBy=me      → notifications the signed-in user sent
 * - sentBy=system  → automatic notifications (no sender: reminders, registration and payment updates)
 * - anything else  → every notification of the center
 */
function notificationFilter(query = {}, userId) {
  if (query.sentBy === "me") return { sentBy: userId };
  if (query.sentBy === "system") return { sentBy: null };
  return {};
}

module.exports = { notificationFilter };
