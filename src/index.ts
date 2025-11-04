import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import { z } from "zod";

dotenv.config();

const app = express();

const allowed = (process.env.ALLOW_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
  credentials: false,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(express.json({ limit: "1mb" }));

// Apply after CORS/preflight so OPTIONS isn't rate-limited
const limiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true });
app.use(limiter);

// Nodemailer transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER, // full gmail address
    pass: process.env.GMAIL_APP_PASSWORD, // 16-char app password
  },
});

const BaseSchema = z.object({
  kind: z.enum(["creator", "business"]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(3),
  country: z.string().min(1),
  niche: z.string().min(1),
  instagram: z.string().optional().default(""),
  tiktok: z.string().optional().default(""),
  about: z.string().min(20),
});

app.post("/api/forms/register", async (req, res) => {
  const parse = BaseSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", details: parse.error.flatten() });
  }
  const data = parse.data;

  const siteOwner = process.env.NOTIFY_EMAIL || process.env.GMAIL_USER!;
  const subjectOwner = `New ${
    data.kind === "creator" ? "Creator" : "Business"
  } Registration - ${data.firstName} ${data.lastName}`;
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Mailer listening on http://localhost:${PORT}`)
);
