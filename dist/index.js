"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const zod_1 = require("zod");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use(express_1.default.json({ limit: "1mb" }));
app.use((0, cors_1.default)({ origin: process.env.ALLOW_ORIGIN?.split(",") ?? "*" }));
const limiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 30 });
app.use(limiter);
// Nodemailer transporter (Gmail SMTP)
const transporter = nodemailer_1.default.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER, // full gmail address
        pass: process.env.GMAIL_APP_PASSWORD, // 16-char app password
    },
});
const BaseSchema = zod_1.z.object({
    kind: zod_1.z.enum(["creator", "business"]),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(3),
    country: zod_1.z.string().min(1),
    niche: zod_1.z.string().min(1),
    instagram: zod_1.z.string().optional().default(""),
    tiktok: zod_1.z.string().optional().default(""),
    about: zod_1.z.string().min(20),
});
app.post("/api/forms/register", async (req, res) => {
    const parse = BaseSchema.safeParse(req.body);
    if (!parse.success) {
        return res
            .status(400)
            .json({ error: "Invalid payload", details: parse.error.flatten() });
    }
    const data = parse.data;
    const siteOwner = process.env.NOTIFY_EMAIL || process.env.GMAIL_USER;
    const subjectOwner = `New ${data.kind === "creator" ? "Creator" : "Business"} Registration - ${data.firstName} ${data.lastName}`;
    const subjectUser = `Thanks for registering with Jali Creators Label`;
    const htmlOwner = `
    <h2>New ${data.kind} registration</h2>
    <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>Phone:</strong> ${data.phone}</p>
    <p><strong>Country:</strong> ${data.country}</p>
    <p><strong>Niche:</strong> ${data.niche}</p>
    <p><strong>Instagram:</strong> ${data.instagram}</p>
    <p><strong>TikTok:</strong> ${data.tiktok}</p>
    <p><strong>About:</strong> ${data.about}</p>
  `;
    const htmlUser = `
    <p>Hi ${data.firstName},</p>
    <p>Thanks for registering with <strong>Jali Creators Label</strong> 🎉. Our team will review your submission and get back to you.</p>
    <p>Cheers,<br/>Jali Team</p>
  `;
    try {
        // send to owner
        await transporter.sendMail({
            from: `"Jali Site" <${process.env.GMAIL_USER}>`,
            to: siteOwner,
            replyTo: data.email,
            subject: subjectOwner,
            html: htmlOwner,
        });
        // send to user
        await transporter.sendMail({
            from: `"Jali Creators Label" <${process.env.GMAIL_USER}>`,
            to: data.email,
            subject: subjectUser,
            html: htmlUser,
        });
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to send email" });
    }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Mailer listening on http://localhost:${PORT}`));
