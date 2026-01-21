import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "cloudflare:workers";
import { WorkerMailer } from "worker-mailer";

const s3 = new S3Client({
  region: env.AWS_REGION,

  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function onRequestPost(context) {
  const { request } = context;
  console.log("env ", env);

  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log("Form submission:", { name, email, subject, message });

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: env.AWS_BUCKET_NAME,
        Key: `Platform-Readiness-Assessment-ridhamparmar511@gmail.com.pdf`,
      }),
      { expiresIn: 60 } // 1 min
    );

    console.log("signed Url ", signedUrl);

    return await sendEmail(signedUrl, email);

  } catch (error) {
    console.log("Error occured ", error);

    return new Response(JSON.stringify({ error: error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function sendEmail(signedUrl, email) {
  const mailer = await WorkerMailer.connect({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT),
    secure: env.SMTP_SECURE === "true", // true for 465
    credentials: {
      username: env.SMTP_USER,
      password: env.SMTP_PASS,
    },
    authType: "login", // or "login"
  });

  await mailer.send({
    from: { email: env.SMTP_FROM },
    to: { email: email },
    subject: "Your Assessment Report is Ready",
    text: `Your report is ready! Download here: ${signedUrl}`,
  });

  return new Response(
    JSON.stringify({
      message: "Message sent successfully!",
      data: { email, signedUrl },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
