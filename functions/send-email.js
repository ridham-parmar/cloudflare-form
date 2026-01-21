import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "cloudflare:workers";

const s3 = new S3Client({
  region: env.AWS_REGION,

  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function onRequestPost(context) {
  const { request } = context;

  const { pathname } = new URL(request.url);
  const { success } = await env.MY_RATE_LIMITER.limit({ key: pathname }); // key can be any string of your choosing
  if (!success) {
    return new Response(`429 Failure – rate limit exceeded for ${pathname}`, {
      status: 429,
    });
  }

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

    return new Response(
      JSON.stringify({
        message: "Message sent successfully!",
        data: { name, email, subject, signedUrl },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
