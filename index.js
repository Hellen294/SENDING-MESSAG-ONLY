const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Read SMTP creds from env config: functions.config().smtp.user / .pass / .host / .port
const smtpUser = functions.config().smtp.user;
const smtpPass = functions.config().smtp.pass;
const smtpHost = functions.config().smtp.host || "smtp.gmail.com";
const smtpPort = Number(functions.config().smtp.port || 587);
const smtpSecure = smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: { user: smtpUser, pass: smtpPass },
});

exports.sendMail = functions.firestore
  .document("mail/{docId}")
  .onCreate(async (snap, context) => {
    const id = context.params.docId;
    const data = snap.data();

    const to = (data.to || "").trim();
    const subject = (data.subject || "").trim();
    const message = (data.message || "").trim();

    // Basic validation
    if (!to || !subject || !message) {
      await db.collection("mail").doc(id).set({
        status: "error",
        error: "Missing to/subject/message",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return null;
    }

    const mailOptions = {
      from: `"SMTP Website" <${smtpUser}>`,
      to,
      subject,
      text: message,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      await db.collection("mail").doc(id).set({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId: info.messageId || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return null;
    } catch (err) {
      await db.collection("mail").doc(id).set({
        status: "error",
        error: err.message || String(err),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return null;
    }
  });
