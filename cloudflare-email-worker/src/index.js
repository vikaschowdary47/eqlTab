// Cloudflare Email Routing -> eqlTab. Receives an email, reads it, and posts the fields eqlTab's
// /api/inbound/email webhook expects: { to, from, subject, text, attachments: [{ filename, contentType, contentBase64 }] }.
// Only the first PDF is sent. The webhook keeps the parsed bill details and the PDF, not the email body.
import PostalMime from "postal-mime";

function toBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export default {
  async email(message, env) {
    // Only addresses eqlTab issued (bills+<18 hex>@...). Anything else is refused here, not passed to the app.
    if (!/^bills\+[a-f0-9]{18}@/i.test(message.to)) {
      message.setReject("Address not found");
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    const mail = await PostalMime.parse(raw);

    const pdf = (mail.attachments ?? []).find((a) => (a.mimeType ?? "").toLowerCase() === "application/pdf");
    const attachments = pdf ? [{ filename: pdf.filename ?? "statement.pdf", contentType: "application/pdf", contentBase64: toBase64(new Uint8Array(pdf.content)) }] : [];

    const res = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-eqlshare-signature": env.WEBHOOK_SECRET },
      body: JSON.stringify({ to: message.to, from: message.from, subject: mail.subject ?? "", text: mail.text ?? "", attachments }),
    });
    // The app answers 200 for every address, known or not. Anything else is a real problem: fail loudly so it shows in the Worker logs.
    if (!res.ok) throw new Error(`eqlTab webhook answered ${res.status}`);
  },
};
