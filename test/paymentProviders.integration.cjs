// Run with a local MongoDB replica set, e.g. PAYMENT_TEST_MONGO_URI pointing at
// mongodb://127.0.0.1:27029/payment_provider_test?replicaSet=conflictTest
// Only gateway network calls are stubbed; HTTP routes, signatures and MongoDB are real.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { test } = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "payment-provider-test-only";
process.env.VNPAY_TMN_CODE = "LOCALTEST";
process.env.VNPAY_HASH_SECRET = "vnpay-test-only-secret";
process.env.VNPAY_RETURN_URL = "http://localhost:5173/payment-result";
process.env.PAYOS_CLIENT_ID = "payos-test-client";
process.env.PAYOS_API_KEY = "payos-test-key";
process.env.PAYOS_CHECKSUM_KEY = "payos-test-checksum";
process.env.PAYMENT_MODE = "payos"; // Must not disable Web VNPay.

const app = require("../src/app");
const Payment = require("../src/models/Payment");
const Registration = require("../src/models/ClassRegistration");
const Member = require("../src/models/Member");
const User = require("../src/models/User");
const Subject = require("../src/models/Subject");
const Course = require("../src/models/Course");
const Class = require("../src/models/Class");
const Coach = require("../src/models/Coach");
const { payosClient, reconcilePayosPayment } = require("../src/services/payosService");
const { applyVnpayResponse } = require("../src/services/vnpayService");

const uri = process.env.PAYMENT_TEST_MONGO_URI;
const parsed = uri && new URL(uri);
if (!parsed || !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
    !/^\/[a-z0-9_]*test[a-z0-9_]*$/i.test(parsed.pathname)) {
  throw new Error("PAYMENT_TEST_MONGO_URI must name a loopback MongoDB test database");
}

test("Shared payment backend: Web VNPay, Mobile payOS", async (t) => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const client = payosClient();
  const gatewayPrototype = Object.getPrototypeOf(client.paymentRequests);
  const originalCreate = gatewayPrototype.create;
  const originalGet = gatewayPrototype.get;
  const links = new Map();
  let createCalls = 0, getCalls = 0;
  gatewayPrototype.create = async function (request) {
    createCalls++;
    if (links.has(request.orderCode)) throw new Error("Existing order");
    const id = crypto.randomBytes(16).toString("hex");
    const link = { ...request, id, status: "PENDING", amountPaid: 0,
      amountRemaining: request.amount, checkoutUrl: `https://pay.payos.vn/web/${id}` };
    links.set(request.orderCode, link);
    return link;
  };
  gatewayPrototype.get = async function (orderCode) {
    getCalls++;
    if (!links.has(orderCode)) throw new Error("Unknown test order");
    return links.get(orderCode);
  };
  t.after(async () => {
    gatewayPrototype.create = originalCreate;
    gatewayPrototype.get = originalGet;
    await new Promise(resolve => server.close(resolve));
    await require("../src/middlewares/activityEvents").flush();
    await mongoose.disconnect();
  });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const id = () => new mongoose.Types.ObjectId();
  const accounts = {};
  for (const role of ["MEMBER", "OTHER_MEMBER", "CENTER_MANAGER", "RECEPTIONIST"]) {
    accounts[role] = await User.create({ email: `${id()}@payment.example.test`, passwordHash: "test-fixture-not-used-for-login", role: role === "OTHER_MEMBER" ? "MEMBER" : role });
  }
  const owner = await Member.create({ userId: accounts.MEMBER._id, fullName: "Payment owner", phone: "0900000000", goal: "Test" });
  const other = await Member.create({ userId: accounts.OTHER_MEMBER._id, fullName: "Other member", phone: "0900000001", goal: "Test" });
  const token = (role, userId = accounts[role]._id) => jwt.sign({ userId, role }, process.env.JWT_SECRET);
  const memberToken = token("MEMBER"), otherToken = token("MEMBER", other.userId);
  const managerToken = token("CENTER_MANAGER"), receptionToken = token("RECEPTIONIST");
  const subject = await Subject.create({ name: `Payment subject ${id()}` });
  const course = await Course.create({ name: "Shared course", subjectId: subject._id,
    price: 90000 });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(route, method = "GET", body, auth = memberToken) {
    const response = await fetch(base + route, { method,
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: response.headers.get("content-type")?.includes("json")
      ? await response.json() : await response.text() };
  }
  async function fixture({ amount = 50000, provider = "VNPAY", method = "ONLINE", legacy = false } = {}) {
    const coach = await Coach.create({ userId: id(), fullName: "Coach", phone: "0900000002", subjectIds: [subject._id] });
    const cls = await Class.create({ name: "Payment class", courseId: course._id, subjectId: subject._id, coachId: coach._id });
    const registration = await Registration.create({ classId: cls._id, memberId: owner._id, priceSnapshot: amount });
    let payment;
    if (legacy) {
      const raw = { _id: id(), classRegistrationId: registration._id, amount, paymentMethod: method, status: "PENDING" };
      if (provider === "PAYOS") raw.payosOrderCode = crypto.randomInt(1, 2 ** 46);
      await Payment.collection.insertOne(raw);
      payment = await Payment.findById(raw._id);
    } else {
      const created = await request(provider === "PAYOS" ? "/payments/payos" : "/payments", "POST", {
        classRegistrationId: registration.id, paymentMethod: method, amount: 1, paymentProvider: "UNTRUSTED",
      });
      assert.equal(created.status, 201, JSON.stringify(created));
      payment = await Payment.findById(created.body.data.id);
    }
    return { payment, registration, cls, coach };
  }
  function callback(payment, overrides = {}) {
    const query = { vnp_TmnCode: process.env.VNPAY_TMN_CODE, vnp_TxnRef: payment.id,
      vnp_Amount: String(payment.amount * 100), vnp_ResponseCode: "00", vnp_TransactionStatus: "00",
      vnp_TransactionNo: "12345678", vnp_BankCode: "NCB", vnp_OrderInfo: "Integration test",
      vnp_PayDate: "20261110090000", ...overrides };
    query.vnp_SecureHash = crypto.createHmac("sha512", process.env.VNPAY_HASH_SECRET)
      .update(new URLSearchParams(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))).toString()).digest("hex");
    return query;
  }
  const verify = (payment, overrides, auth = memberToken) =>
    request("/payments/vnpay/verify-return", "POST", callback(payment, overrides), auth);
  async function webhook(orderCode, overrides = {}) {
    const link = links.get(orderCode);
    const data = { code: "00", orderCode, paymentLinkId: link?.id || "a".repeat(32), amount: link?.amount || 50000, ...overrides };
    const signature = await client.crypto.createSignatureFromObj(data, process.env.PAYOS_CHECKSUM_KEY);
    return request("/payments/payos/webhook", "POST", { data, signature }, null);
  }
  async function checkout(payment, expected = 200) {
    const response = await request(`/payments/${payment.id}/checkout`, "POST");
    assert.equal(response.status, expected, JSON.stringify(response));
    return Payment.findById(payment.id);
  }
  function markPaid(payment) {
    const link = links.get(payment.payosOrderCode);
    link.status = "PAID"; link.amountPaid = payment.amount; link.amountRemaining = 0;
  }
  async function state(payment, registration) {
    return [(await Payment.findById(payment.id)).status, (await Registration.findById(registration.id)).status];
  }

  await t.test("Member class metadata exposes one per-student price", async () => {
    const f = await fixture();
    const response = await request("/classes");
    assert.equal(response.status, 200);
    const row = response.body.data.find(item => item._id === f.cls.id);
    assert.equal(row.courseId.price, 90000);
    assert.equal(row.courseId.pricing, undefined);
    assert.equal(row.classType, undefined);
  });
  await t.test("Course API accepts one fee and rejects missing or invalid tuition", async () => {
    const created = await request("/courses", "POST", { subjectId: subject.id, name: `Tuition ${id()}`, price: 65000 }, managerToken);
    assert.equal(created.status, 201, JSON.stringify(created));
    assert.equal(created.body.data.price, 65000);
    assert.equal(created.body.data.pricing, undefined);
    const updated = await request(`/courses/${created.body.data.id}`, "PUT", { price: 75000 }, managerToken);
    assert.equal(updated.status, 200); assert.equal(updated.body.data.price, 75000);
    for (const value of [undefined, null, -1, "50000"]) {
      const invalid = await request("/courses", "POST", { subjectId: subject.id, name: `Invalid ${id()}`, price: value }, managerToken);
      assert.equal(invalid.status, 400);
    }
  });
  await t.test("Legacy group fee is the common tuition; changing it never rewrites old snapshots", async () => {
    const legacyCourse = await Course.create({ name: `Legacy ${id()}`, subjectId: subject._id,
      pricing: { group: 70000, personal: 130000 } });
    const list = await request("/courses");
    const legacy = list.body.data.find(item => item._id === legacyCourse.id);
    assert.equal(legacy.price, 70000); assert.equal(legacy.pricing, undefined);
    const f = await fixture();
    await Class.updateOne({ _id: f.cls._id }, { $set: { courseId: legacyCourse._id } });
    const changed = await request(`/courses/${legacyCourse.id}`, "PUT", { price: 80000 }, managerToken);
    assert.equal(changed.status, 200); assert.equal(changed.body.data.price, 80000);
    assert.equal((await Registration.findById(f.registration.id)).priceSnapshot, 50000);
    assert.equal((await Payment.findById(f.payment.id)).amount, 50000);
    const coach = await Coach.create({ userId: id(), fullName: "Common fee coach", phone: "000", subjectIds: [subject._id] });
    const cls = await Class.create({ name: "New common tuition", subjectId: subject._id, courseId: legacyCourse._id, coachId: coach._id });
    for (const auth of [memberToken, otherToken]) {
      const registered = await request("/class-registrations", "POST", { classId: cls.id }, auth);
      assert.equal(registered.status, 201); assert.equal(registered.body.data.priceSnapshot, 80000);
    }
  });
  await t.test("Each student pays the full course tuition, including legacy PERSONAL classes", async () => {
    for (const legacyType of [undefined, "PERSONAL"]) {
      const expected = 90000;
      const f = await fixture();
      await Payment.deleteOne({ _id: f.payment._id });
      await Registration.deleteOne({ _id: f.registration._id });
      await Class.deleteOne({ _id: f.cls._id });
      const created = await request("/classes", "POST", {
        name: "Student checkout", subjectId: subject.id, courseId: course.id,
        coachId: f.coach.id,
      }, managerToken);
      assert.equal(created.status, 201, JSON.stringify(created));
      assert.equal(created.body.data.classType, undefined);
      const classId = created.body.data.id;
      if (legacyType) await Class.collection.updateOne({ _id: new mongoose.Types.ObjectId(classId) }, { $set: { classType: legacyType } });
      const registered = await request("/class-registrations", "POST", {
        classId, priceSnapshot: 1, amount: 1, classType: "UNTRUSTED",
      });
      assert.equal(registered.status, 201, JSON.stringify(registered));
      assert.equal(registered.body.data.classId, classId);
      assert.equal(registered.body.data.priceSnapshot, expected);
      const registrationId = registered.body.data._id;
      const anotherMember = await request("/class-registrations", "POST", { classId }, otherToken);
      assert.equal(anotherMember.status, 201);
      assert.equal(anotherMember.body.data.priceSnapshot, expected);
      const mine = await request("/class-registrations");
      assert.equal(mine.status, 200);
      assert(mine.body.data.some(row => row._id === registrationId));
      assert(mine.body.data.every(row => row.memberId._id === owner.id));
      const theirs = await request("/class-registrations", "GET", undefined, otherToken);
      assert.equal(theirs.status, 200);
      assert(theirs.body.data.every(row => row.memberId._id === other.id));
      assert(!theirs.body.data.some(row => row._id === registrationId));
      const paymentResult = await request("/payments", "POST", {
        classRegistrationId: registrationId, paymentMethod: "ONLINE", amount: 1,
      });
      assert.equal(paymentResult.status, 201, JSON.stringify(paymentResult));
      assert.equal(paymentResult.body.data.amount, expected);
      assert.equal(paymentResult.body.data.classRegistrationId, registrationId);
      const payment = await Payment.findById(paymentResult.body.data.id);
      const checkout = await request(`/payments/${payment.id}/vnpay`, "POST");
      assert.equal(checkout.status, 200);
      const url = new URL(checkout.body.data.paymentUrl);
      assert.equal(url.searchParams.get("vnp_TxnRef"), payment.id);
      assert.equal(url.searchParams.get("vnp_Amount"), String(expected * 100));
      assert.equal((await verify(payment)).status, 200);
      assert.deepEqual(await state(payment, await Registration.findById(registrationId)), ["SUCCESS", "CONFIRMED"]);
      const unrelated = await Registration.findOne({ classId, memberId: other._id });
      assert.equal(unrelated.status, "PENDING_PAYMENT");
      const otherPayment = await request("/payments", "POST", { classRegistrationId: unrelated.id, paymentMethod: "ONLINE" }, otherToken);
      assert.equal(otherPayment.status, 201);
      assert.equal(otherPayment.body.data.amount, expected);
      assert.notEqual(otherPayment.body.data.id, payment.id);
    }
  });
  await t.test("Web uses snapshot and VNPay even when PAYMENT_MODE=payos", async () => {
    const { payment } = await fixture();
    assert.equal(payment.paymentProvider, "VNPAY"); assert.equal(payment.amount, 50000);
    const response = await request(`/payments/${payment.id}/vnpay`, "POST");
    assert.equal(response.status, 200);
    const url = new URL(response.body.data.paymentUrl);
    assert.equal(url.hostname, "sandbox.vnpayment.vn"); assert.equal(url.searchParams.get("vnp_Amount"), "5000000");
    const before = createCalls;
    await checkout(payment, 404); assert.equal(createCalls, before);
    assert.equal((await Payment.findById(payment.id)).payosOrderCode, undefined);
  });
  await t.test("Mobile payOS stays isolated before any order code exists", async () => {
    const { payment, registration } = await fixture({ provider: "PAYOS" });
    assert.equal(payment.paymentProvider, "PAYOS"); assert.equal(payment.payosOrderCode, undefined);
    assert.equal((await request(`/payments/${payment.id}/vnpay`, "POST")).status, 404);
    assert.equal((await verify(payment)).status, 404);
    const ipn = await request("/payments/vnpay-ipn?" + new URLSearchParams(callback(payment)), "GET", undefined, null);
    assert.equal(ipn.body.RspCode, "01");
    assert.deepEqual(await state(payment, registration), ["PENDING", "PENDING_PAYMENT"]);
  });
  await t.test("Concurrent requests reuse payment; another gateway cannot reuse it", async () => {
    const { payment, registration } = await fixture({ provider: "PAYOS" });
    const rows = await Promise.all(Array.from({ length: 5 }, () => request("/payments/payos", "POST", {
      classRegistrationId: registration.id, paymentMethod: "ONLINE" })));
    rows.forEach(row => { assert.equal(row.status, 200); assert.equal(row.body.data.id, payment.id); });
    assert.equal(await Payment.countDocuments({ classRegistrationId: registration._id }), 1);
    assert.equal((await request("/payments", "POST", { classRegistrationId: registration.id, paymentMethod: "ONLINE" })).status, 409);
  });
  await t.test("Mobile creation requires authentication, ownership, ONLINE and member role", async () => {
    const { registration } = await fixture();
    const body = { classRegistrationId: registration.id, paymentMethod: "ONLINE" };
    assert.equal((await request("/payments/payos", "POST", body, null)).status, 401);
    assert.equal((await request("/payments/payos", "POST", body, otherToken)).status, 403);
    assert.equal((await request("/payments/payos", "POST", body, managerToken)).status, 403);
    assert.equal((await request("/payments/payos", "POST", { ...body, paymentMethod: "CASH" })).status, 400);
  });
  await t.test("payOS checkout reuses an order and rejects other owners", async () => {
    const { payment } = await fixture({ provider: "PAYOS" });
    const rows = await Promise.all([checkout(payment), checkout(payment), checkout(payment)]);
    assert.equal(new Set(rows.map(row => row.payosOrderCode)).size, 1);
    const saved = rows[0];
    assert.equal((await request(`/payments/${payment.id}/checkout`, "POST", undefined, otherToken)).status, 404);
    assert.equal((await verify(saved)).status, 404);
  });
  await t.test("Signed payOS webhook and status polling confirm exactly once", async () => {
    const { payment, registration } = await fixture({ provider: "PAYOS" });
    const saved = await checkout(payment); markPaid(saved);
    const results = await Promise.all([webhook(saved.payosOrderCode), webhook(saved.payosOrderCode), request(`/payments/${payment.id}/status`)]);
    results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result)));
    assert.deepEqual(await state(payment, registration), ["SUCCESS", "CONFIRMED"]);
    const date = (await Payment.findById(payment.id)).paymentDate.getTime();
    assert.equal((await webhook(saved.payosOrderCode)).status, 200);
    assert.equal((await Payment.findById(payment.id)).paymentDate.getTime(), date);
  });
  await t.test("Unsigned and tampered payOS webhooks cannot change state", async () => {
    const { payment, registration } = await fixture({ provider: "PAYOS" });
    const saved = await checkout(payment); markPaid(saved);
    const response = await request("/payments/payos/webhook", "POST", {
      data: { code: "00", orderCode: saved.payosOrderCode, paymentLinkId: links.get(saved.payosOrderCode).id }, signature: "invalid" }, null);
    assert.equal(response.status, 400);
    assert.deepEqual(await state(payment, registration), ["PENDING", "PENDING_PAYMENT"]);
  });
  await t.test("Signed webhook alone is insufficient when gateway amount or link mismatches", async () => {
    const { payment, registration } = await fixture({ provider: "PAYOS" });
    const saved = await checkout(payment); markPaid(saved);
    assert.equal((await webhook(saved.payosOrderCode, { paymentLinkId: "b".repeat(32) })).status, 500);
    links.get(saved.payosOrderCode).amount++;
    assert.equal((await webhook(saved.payosOrderCode)).status, 500);
    assert.deepEqual(await state(payment, registration), ["PENDING", "PENDING_PAYMENT"]);
  });
  await t.test("payOS rejects VNPay even if the record contains a stray payOS order code", async () => {
    const { payment, registration } = await fixture();
    const orderCode = crypto.randomInt(1, 2 ** 46);
    await Payment.collection.updateOne({ _id: payment._id }, { $set: { payosOrderCode: orderCode } });
    const before = getCalls;
    assert.equal((await webhook(orderCode)).status, 200); assert.equal(getCalls, before);
    await assert.rejects(reconcilePayosPayment(client, { _id: payment._id, payosOrderCode: orderCode }), /does not belong/);
    assert.equal((await verify(payment)).status, 404);
    assert.deepEqual(await state(payment, registration), ["PENDING", "PENDING_PAYMENT"]);
  });
  await t.test("Legacy VNPay and payOS records remain confined to their original gateways", async () => {
    const web = await fixture({ legacy: true });
    assert.equal((await verify(web.payment)).status, 200);
    assert.deepEqual(await state(web.payment, web.registration), ["SUCCESS", "CONFIRMED"]);
    const mobile = await fixture({ legacy: true, provider: "PAYOS" });
    const code = mobile.payment.payosOrderCode;
    links.set(code, { orderCode: code, id: "c".repeat(32), amount: 50000, amountPaid: 50000, amountRemaining: 0, status: "PAID" });
    assert.equal((await verify(mobile.payment)).status, 404);
    assert.equal((await webhook(code)).status, 200);
    assert.deepEqual(await state(mobile.payment, mobile.registration), ["SUCCESS", "CONFIRMED"]);
  });
  await t.test("VNPay checks signatures, amount and merchant before state changes", async () => {
    const { payment, registration } = await fixture();
    assert.equal((await verify(payment, { vnp_Amount: "100" })).status, 400);
    assert.equal((await verify(payment, { vnp_TmnCode: "OTHER" })).status, 400);
    const query = callback(payment); query.vnp_Amount = "1";
    assert.equal((await request("/payments/vnpay/verify-return", "POST", query)).status, 400);
    assert.deepEqual(await state(payment, registration), ["PENDING", "PENDING_PAYMENT"]);
  });
  await t.test("SUCCESS and FAILED remain terminal for both gateways", async () => {
    const web = await fixture();
    assert.equal((await verify(web.payment, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" })).status, 200);
    assert.equal((await verify(web.payment)).body.data.status, "FAILED");
    assert.deepEqual(await state(web.payment, web.registration), ["FAILED", "PENDING_PAYMENT"]);
    const mobile = await fixture({ provider: "PAYOS" });
    const saved = await checkout(mobile.payment);
    links.get(saved.payosOrderCode).status = "EXPIRED";
    await reconcilePayosPayment(client, saved);
    markPaid(saved); await reconcilePayosPayment(client, saved);
    assert.deepEqual(await state(saved, mobile.registration), ["FAILED", "PENDING_PAYMENT"]);
    const success = await fixture(); await verify(success.payment);
    await verify(success.payment, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" });
    assert.deepEqual(await state(success.payment, success.registration), ["SUCCESS", "CONFIRMED"]);
  });
  await t.test("Paid cancelled registrations remain cancelled and report refund handling", async () => {
    for (const provider of ["VNPAY", "PAYOS"]) {
      const f = await fixture({ provider });
      const payment = provider === "PAYOS" ? await checkout(f.payment) : f.payment;
      await Registration.updateOne({ _id: f.registration._id }, { $set: { status: "CANCELLED" } });
      if (provider === "PAYOS") { markPaid(payment); assert.equal((await webhook(payment.payosOrderCode)).status, 200); }
      else assert.equal((await verify(payment)).body.data.manualRefundRequired, true);
      assert.deepEqual(await state(payment, f.registration), ["SUCCESS", "CANCELLED"]);
      assert.equal((await request(`/payments/${payment.id}/status`)).body.data.manualRefundRequired, true);
    }
  });
  await t.test("Gateway limits do not prevent a small Mobile payOS payment", async () => {
    const mobile = await fixture({ provider: "PAYOS", amount: 1000 }); await checkout(mobile.payment);
    const web = await fixture({ amount: 1000 });
    assert.equal((await request(`/payments/${web.payment.id}/vnpay`, "POST")).status, 400);
  });
  await t.test("Public update cannot move gateway, amount or online method", async () => {
    const { payment } = await fixture({ provider: "PAYOS" });
    for (const body of [{ paymentProvider: "VNPAY" }, { amount: 1 }, { status: "SUCCESS" }]) {
      assert.equal((await request(`/payments/${payment.id}`, "PUT", body)).status, 400);
    }
    assert.equal((await request(`/payments/${payment.id}`, "PUT", { paymentMethod: "CASH" }, receptionToken)).status, 409);
    assert.equal((await Payment.findById(payment.id)).paymentProvider, "PAYOS");
  });
  await t.test("Existing offline recording remains available to reception", async () => {
    const f = await fixture({ method: "CASH" });
    assert.equal((await request(`/payments/${f.payment.id}/record-payment`, "POST", undefined, receptionToken)).status, 200);
    assert.deepEqual(await state(f.payment, f.registration), ["SUCCESS", "CONFIRMED"]);
    const otherOffline = await fixture({ method: "BANK_TRANSFER" });
    assert.equal((await request(`/payments/${otherOffline.payment.id}`, "PUT", { paymentMethod: "ONLINE" }, receptionToken)).status, 200);
    assert.equal((await Payment.findById(otherOffline.payment.id)).paymentProvider, "VNPAY");
  });
  await t.test("A database failure rolls back payment and registration together for both gateways", async () => {
    for (const provider of ["VNPAY", "PAYOS"]) {
      const f = await fixture({ provider });
      const payment = provider === "PAYOS" ? await checkout(f.payment) : f.payment;
      if (provider === "PAYOS") markPaid(payment);
      await mongoose.connection.db.command({ collMod: "classRegistrations", validator: { status: { $ne: "CONFIRMED" } }, validationAction: "error", validationLevel: "strict" });
      try {
        if (provider === "PAYOS") await assert.rejects(reconcilePayosPayment(client, payment));
        else await assert.rejects(applyVnpayResponse({ vnp_TxnRef: payment.id, vnp_Amount: payment.amount, isSuccess: true }));
        assert.deepEqual(await state(payment, f.registration), ["PENDING", "PENDING_PAYMENT"]);
      } finally { await mongoose.connection.db.command({ collMod: "classRegistrations", validator: {} }); }
    }
  });
  await t.test("Class updates preserve coach qualification and uniqueness with multiple students", async () => {
    const f = await fixture();
    const body = { name: "Updated class", courseId: course.id, coachId: f.coach.id };
    await Registration.create({ classId: f.cls._id, memberId: other._id, priceSnapshot: 50000 });
    assert.equal((await request(`/classes/${f.cls.id}`, "PUT", body, managerToken)).status, 200);
    const wrongCoach = await Coach.create({ userId: id(), fullName: "Other subject coach", phone: "000", subjectIds: [id()] });
    assert.equal((await request(`/classes/${f.cls.id}`, "PUT", { ...body, coachId: wrongCoach.id }, managerToken)).status, 400);
    assert.equal((await request("/classes", "POST", { name: "Duplicate", courseId: course.id, coachId: f.coach.id }, managerToken)).status, 409);
    const single = await fixture();
    const changed = await request(`/classes/${single.cls.id}`, "PUT", { ...body, coachId: single.coach.id }, managerToken);
    assert.equal(changed.status, 200); assert.equal(changed.body.data.classType, undefined);
  });
  await t.test("Class deletion protects upstream history and local workout/progress references", async () => {
    for (const kind of ["Attendance", "WorkoutPlan", "LessonProgress", null]) {
      const f = await fixture();
      await Payment.deleteOne({ _id: f.payment._id }); await Registration.deleteOne({ _id: f.registration._id });
      if (kind === "Attendance") await mongoose.model(kind).create({ classId: f.cls._id, memberId: owner._id, lessonId: id(), date: new Date(), status: "PRESENT" });
      if (kind === "WorkoutPlan") await mongoose.model(kind).create({ classId: f.cls._id, coachId: f.coach._id, goal: "Test", plan: "Test", level: "BEGINNER" });
      if (kind === "LessonProgress") await mongoose.model(kind).create({ classId: f.cls._id, memberId: owner._id, lessonId: id() });
      assert.equal((await request(`/classes/${f.cls.id}`, "DELETE", undefined, managerToken)).status, kind ? 409 : 200);
      assert.equal(Boolean(await Class.exists({ _id: f.cls._id })), Boolean(kind));
    }
  });
});
