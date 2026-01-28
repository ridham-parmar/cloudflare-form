import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "cloudflare:workers";
import { WorkerMailer } from "worker-mailer";
import { Buffer } from "buffer";

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

    const data = {
      userName: "ridham",
      userEmail: "ridhamparmar511@gmail.com",
      assessmentDate: "2026-01-22T07:09:19.766Z",
      scores: { overallReadiness: 0, twelveFactorScore: 0, doraScore: 0 },
      cncfMaturity: {
        currentStage: "Initial",
        description:
          "Manual processes, inconsistent practices, ad-hoc tooling. Little to no dedicated platform team. Development teams manage most infrastructure concerns.",
        characteristics: [
          "Manual provisioning and deployment.",
          "Inconsistent environments across teams.",
          "Lack of standardized tools or practices.",
          "High operational burden on developers.",
        ],
      },
      allStages: [
        {
          name: "Initial",
          description:
            "Manual processes, inconsistent practices, ad-hoc tooling. Little to no dedicated platform team. Development teams manage most infrastructure concerns.",
          characteristics: [
            "Manual provisioning and deployment.",
            "Inconsistent environments across teams.",
            "Lack of standardized tools or practices.",
            "High operational burden on developers.",
          ],
        },
        {
          name: "Basic",
          description:
            "Some automation efforts, shared tools, emergent best practices. Early stages of a platform team or dedicated individuals supporting core infrastructure.",
          characteristics: [
            "Basic CI/CD pipelines established.",
            "Centralized logging/monitoring tools introduced.",
            "Limited self-service capabilities.",
            "Focus on foundational infrastructure (compute, network, storage).",
          ],
        },
        {
          name: "Advanced",
          description:
            "Standardized self-service, robust automation, comprehensive observability. A dedicated platform team providing internal products and services.",
          characteristics: [
            "Automated infrastructure provisioning (IaC).",
            "Standardized application deployment pipelines.",
            "Comprehensive observability stack (metrics, logs, traces).",
            "Developer self-service portals and APIs for common tasks.",
            "Focus on developer experience and productivity.",
          ],
        },
        {
          name: "Optimized",
          description:
            "Highly autonomous teams, platform as a product, continuous improvement, innovation focus. Platform team acts as enablers and innovators.",
          characteristics: [
            "Full self-service with guardrails.",
            "Advanced automation and intelligent operations.",
            "Proactive incident response and chaos engineering.",
            "Data-driven platform development and continuous feedback loops.",
            "Focus on business outcomes and innovation through platform capabilities.",
          ],
        },
      ],
      recommandations: {
        label: "Initial stage",
        description:
          "\n" +
          "      Focus on foundational improvements: establish basic CI/CD, centralize logging,\n" +
          "      and begin standardizing development environments. Consider starting with a small,\n" +
          "      dedicated platform team to explore platform concepts.\n" +
          "    ",
      },
    };

    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const htmlContent = generatePdfHtml(data);

    const pdfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/pdf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: htmlContent,
        }),
      }
    );
    console.log("pdf response ", pdfResponse);

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error("PDF generation error:", errorText);
      throw new Error(
        `PDF generation failed: ${pdfResponse.statusText} - ${errorText}`
      );
    }
    
    const arrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBuffer = await Buffer.from(arrayBuffer)
    console.log("type of buffer ", typeof pdfBuffer);
    console.log("pdfbuffer---------", pdfBuffer);
    
    // const signedUrl = await uploadToS3(pdfBuffer, data.userEmail);

    return await sendEmail(pdfBuffer, data.userEmail);
  } catch (error) {
    console.error(`Error  from onRequestPost:`, error);

    const errorResponse = {
      error: {
        message: error.message || "An unknown error occurred",
        type: error.name || "Error",
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: error.statusCode || 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// async function uploadToS3(pdfBuffer, userEmail) {
//   try {
//     await s3.send(
//       new PutObjectCommand({
//         Bucket: env.AWS_BUCKET_NAME,
//         Key: `Platform-Readiness-Assessment-${userEmail}.pdf`,
//         Body: pdfBuffer,
//         ContentType: "application/pdf",
//         "Content-Disposition": `attachment; filename="Platform-Readiness-Assessment-${userEmail}.pdf"`,
//       })
//     );

//     const signedUrl = await getSignedUrl(
//       s3,
//       new GetObjectCommand({
//         Bucket: env.AWS_BUCKET_NAME,
//         Key: `Platform-Readiness-Assessment-${userEmail}.pdf`,
//       }),
//       { expiresIn: 60 }
//     );

//     // return new Response(`Sent mail to user ${userEmail}`, {
//     //   status: 200,
//     // });
//     return signedUrl;
//   } catch (error) {
//     const s3Error = new Error(`S3 upload failed: ${error.message}`);
//     s3Error.name = error.name || "S3Error";
//     s3Error.statusCode = error.$metadata?.httpStatusCode;
//     s3Error.originalError = error;

//     throw s3Error;
//   }
// }

async function sendEmail(pdfBuffer, email) {
  try {
    const mailer = await WorkerMailer.connect({
      host: env.SMTP_HOST,
      port: parseInt(env.SMTP_PORT),
      secure: env.SMTP_SECURE === "true",
      credentials: {
        username: env.SMTP_USER,
        password: env.SMTP_PASS,
      },
      authType: "login",
    });

    await mailer.send({
      from: { email: env.SMTP_FROM },
      to: { email: email },
      subject: "Your Assessment Report is Ready",
      html: `
      <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #ffffff;
              border-radius: 8px;
              padding: 30px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #141414;
              font-size: 24px;
              margin-bottom: 10px;
            }
            .content {
              margin-bottom: 30px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 14px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Platform Engineering Readiness Assessment Report</h1>
            </div>
            
            <div class="content">
              <p>Hello,</p>
              
              <p>Thank you for completing the Platform Engineering Readiness Assessment. Your comprehensive report has been generated and it is attached to this email.</p>
              
              <p>This report includes:</p>
              <ul>
                <li>Your current platform maturity score</li>
                <li>Analysis across all assessment categories</li>
                <li>Personalized recommendations for improvement</li>
              </ul>
            
            </div>
            
            <p>Best regards,<br>
            <strong>Improwised Technologies Pvt. Ltd.</strong></p>

            <div class="footer">
              <p>Need help with your platform engineering journey?</p>
              <p>Learn more about our <a href="https://www.improwised.com/services/platform-engineering/" style="color: #0066cc;">Platform Engineering services</a> or visit us at <a href="https://www.improwised.com" style="color: #0066cc;">improwised.com</a></p>
              <p style="margin-top: 20px; font-size: 12px; color: #999;">This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `Platform_engineering_assessment_${email.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return new Response(
      JSON.stringify({
        message: "Message sent successfully!",
        data: { email },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const emailError = new Error(`Email sending error: ${error.message}`);
    emailError.name = error.name || "emailError";
    emailError.statusCode = error.code || error.statusCode;
    emailError.originalError = error;

    throw emailError;
  }
}

async function createLead(name, email) {
  try {
    const res = await fetch(`${env.CRM_HOST}/api/resource/CRM Lead`, {
      method: "POST",
      headers: {
        Authorization: `token ${env.CRM_API_KEY}:${env.CRM_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: name,
        email: email,
        source: "Website",
        status: "New",
      }),
    });

    const lead = await res.json()
    console.log(lead);
    
    if (lead.exc_type) {
      console.error("Lead generation failed:", lead.exception);
      throw new Error(
        `${lead.exception || lead.exc_type}`
      );
    }
    return new Response(
      JSON.stringify({
        message: "Message sent successfully!",
        data: { email },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.log("crm error ", error);
    const leadGenerationError = new Error(
      `Lead generation failed: ${error.message}`
    );
    leadGenerationError.name = error.name || "leadGenerationError";
    leadGenerationError.statusCode = error.code || error.statusCode || 500;
    leadGenerationError.originalError = error;

    throw leadGenerationError;
  }
}

function generatePdfHtml(data) {
  const {
    userName,
    assessmentDate,
    scores,
    cncfMaturity,
    allStages,
    recommandations,
  } = data;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#22C55E";
    if (score >= 60) return "#00AFDB";
    if (score >= 40) return "#F59E0B";
    return "#EF4444";
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Improvement";
  };

  const stagesHtml =
    allStages
      ?.map((stage, index) => {
        const isCurrentStage = stage.name === cncfMaturity?.currentStage;
        return `
      <div class="stage-item ${isCurrentStage ? "current-stage" : ""}">
        ${isCurrentStage ? '<div class="stage-badge">Your Stage</div>' : ""}
        <h3>${index + 1}. ${stage.name}</h3>
        <p>${stage.description}</p>
        <strong>Key Characteristics:</strong>
        <ul>
          ${stage.characteristics.map((char) => `<li>${char}</li>`).join("")}
        </ul>
      </div>
    `;
      })
      .join("") || "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Platform Engineering Readiness Assessment Report</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@700;800&display=swap" rel="stylesheet">
      <style>
        @page {
          margin: 0.50in;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', sans-serif;
          color: #141414;
          background: #ffffff;
          line-height: 1.6;
        }
        .container {
          max-width: 100%;
          margin: 0 auto;
          padding: 0;
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 3px solid #009DC9;
        }
        .header h1 {
          font-family: 'Manrope', sans-serif;
          font-size: 32px;
          font-weight: 800;
          color: #141414;
          margin-bottom: 6px;
          line-height: 1.2;
        }
        .header .subtitle {
          font-size: 15px;
          color: #292929;
          font-weight: 500;
        }
        .user-info {
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          padding: 16px 24px;
          border-radius: 10px;
          margin-bottom: 28px;
          border-left: 4px solid #009DC9;
          page-break-inside: avoid;
        }
        .user-info p {
          margin: 4px 0;
          font-size: 13px;
          color: #292929;
        }
        .user-info strong {
          color: #141414;
          font-weight: 600;
        }
        .section {
          margin-bottom: 32px;
          page-break-inside: avoid;
        }
        .section-title {
          font-family: 'Manrope', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #141414;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e5e5;
        }
        .scores-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .score-card {
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          page-break-inside: avoid;
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
        }
        .score-card-overall {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
        }
        .score-card-twelve-factor {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
        }
        .score-card-dora {
          background-color: #faf5ff;
          border: 1px solid #e9d5ff;
        }
        .score-card .score-label {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .score-label-overall {
          color: #1e40af;
        }
        .score-label-twelve-factor {
          color: #166534;
        }
        .score-label-dora {
          color: #6b21a8;
        }
        .score-desc {
          font-size: 12px;
          margin-top: 8px;
          line-height: 1.4;
        }
        .score-desc-overall {
          color: #1d4ed8;
        }
        .score-desc-twelve-factor {
          color: #15803d;
        }
        .score-desc-dora {
          color: #7e22ce;
        }
        .score-card .score-value {
          font-size: 44px;
          font-weight: 700;
          font-family: 'Manrope', sans-serif;
          margin-bottom: 0;
          line-height: 1;
        }
        .score-value-overall {
          color: #2563eb;
        }
        .score-value-twelve-factor {
          color: #16a34a;
        }
        .score-value-dora {
          color: #9333ea;
        }
        .maturity-section {
          background: linear-gradient(135deg, rgba(0, 157, 201, 0.05), rgba(0, 175, 219, 0.05));
          padding: 24px;
          border-radius: 10px;
          border: 2px solid #009DC9;
          page-break-inside: avoid;
        }
        .maturity-section h3 {
          font-family: 'Manrope', sans-serif;
          font-size: 24px;
          color: #009DC9;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .maturity-section .description {
          font-size: 14px;
          color: #292929;
          line-height: 1.6;
          margin-bottom: 14px;
        }
        .characteristics-list {
          list-style: none;
          padding: 0;
        }
        .characteristics-list li {
          padding: 6px 0 6px 26px;
          position: relative;
          font-size: 13px;
          color: #292929;
          line-height: 1.5;
        }
        .characteristics-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #009DC9;
          font-weight: bold;
          font-size: 16px;
        }
        .stage-item {
          background: #ffffff;
          border: 2px solid #e5e5e5;
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 16px;
          page-break-inside: avoid;
        }
        .stage-item.current-stage {
          background: linear-gradient(135deg, rgba(0, 157, 201, 0.08), rgba(0, 175, 219, 0.08));
          border: 2px solid #009DC9;
          position: relative;
        }
        .stage-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: #009DC9;
          color: white;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 600;
        }
        .stage-item h3 {
          color: #141414;
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 8px 0;
          font-family: 'Manrope', sans-serif;
        }
        .stage-item p {
          color: #292929;
          font-size: 13px;
          line-height: 1.5;
          margin: 0 0 10px 0;
        }
        .stage-item strong {
          color: #141414;
          font-size: 13px;
          display: block;
          margin-bottom: 8px;
        }
        .stage-item ul {
          margin: 0;
          padding-left: 18px;
          color: #292929;
          font-size: 12px;
          line-height: 1.6;
        }
        .stage-item ul li {
          margin-bottom: 4px;
        }
        .recommendations {
          background: #fffbeb;
          border: 2px solid #F59E0B;
          border-radius: 10px;
          padding: 20px;
          page-break-inside: avoid;
        }
        .recommendations h4 {
          font-family: 'Manrope', sans-serif;
          font-size: 17px;
          color: #141414;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .recommendations p {
          font-size: 13px;
          color: #292929;
          line-height: 1.6;
        }
        .footer {
          margin-top: 36px;
          padding-top: 20px;
          border-top: 2px solid #e5e5e5;
          text-align: center;
          color: #292929;
          font-size: 12px;
          page-break-inside: avoid;
        }
        .footer p {
          margin: 6px 0;
        }
        .footer strong {
          color: #009DC9;
          font-weight: 600;
        }
        a {
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Platform Engineering Readiness Assessment</h1>
          <p class="subtitle">Comprehensive Analysis Report</p>
        </div>

        <div class="user-info">
          <p><strong>Name:</strong> ${userName}</p>
          <p><strong>Assessment Date:</strong> ${formatDate(assessmentDate)}</p>
        </div>

        <div class="section">
          <h2 class="section-title">Assessment Scores</h2>
          <div class="scores-grid">
            <div class="score-card score-card-overall">
              <h3 class="score-label score-label-overall">Overall Readiness</h3>
              <p class="score-value score-value-overall">${Math.round(
                scores?.overallReadiness || 0
              )}%</p>
              <p class="score-desc score-desc-overall">Combined 12-Factor & DORA Score</p>
            </div>
            <div class="score-card score-card-twelve-factor">
              <h3 class="score-label score-label-twelve-factor">12-Factor Alignment</h3>
              <p class="score-value score-value-twelve-factor">${Math.round(
                scores?.twelveFactorScore || 0
              )}%</p>
              <p class="score-desc score-desc-twelve-factor">How well your apps follow 12-Factor principles</p>
            </div>
            <div class="score-card score-card-dora">
              <h3 class="score-label score-label-dora">DORA Performance</h3>
              <p class="score-value score-value-dora">${Math.round(
                scores?.doraScore || 0
              )}%</p>
              <p class="score-desc score-desc-dora">Your software delivery performance</p>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">Your CNCF Platform Engineering Maturity Level</h2>
          <div class="maturity-section">
            <h3>${cncfMaturity?.currentStage || "Not Available"}</h3>
            <p class="description">${cncfMaturity?.description || ""}</p>
            ${
              cncfMaturity?.characteristics
                ? `
              <strong style="display: block; margin-bottom: 12px; color: #141414; font-size: 15px;">Key Characteristics:</strong>
              <ul class="characteristics-list">
                ${cncfMaturity.characteristics
                  .map((char) => `<li>${char}</li>`)
                  .join("")}
              </ul>
            `
                : ""
            }
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">All CNCF Platform Engineering Maturity Stages</h2>
          ${stagesHtml}
        </div>

        ${
          recommandations
            ? `
          <div class="section">
            <h2 class="section-title">Recommendations for Your Organization</h2>
            <div class="recommendations">
              <h4>${recommandations.label}</h4>
              <p>${recommandations.description}</p>
            </div>
          </div>
        `
            : ""
        }

        <div class="footer">
          <p>This report was generated based on your responses to the Platform Engineering Readiness Assessment.</p>
          <p>For more information about our <a href="https://www.improwised.com/services/platform-engineering/"><strong>Platform Engineering services</strong></a>, visit us at <a href="https://www.improwised.com"><strong>improwised.com</strong></a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
