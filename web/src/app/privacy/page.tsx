import type { Metadata } from "next";
import { LegalPage } from "../legal";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy">
      <h2>What we collect</h2>
      <p>Your name and email, the Spaces you create or join, the bills and shares you enter, payment reports you record, and statements you upload. From statements we keep the provider, amount due, due date, billing period and the last four digits of the account number, plus the original PDF.</p>
      <h2>Gmail</h2>
      <p>If you connect Gmail, we search only for emails from the companies you choose (or that you tick after "Find my bills in Gmail", which looks only at the sender and subject of emails that look like bills). From those emails we keep the bill details listed above and any attached bill PDF. We don't store your emails, and we don't read anything else in your inbox. You can disconnect Gmail at any time, which removes our access.</p>
      <h2>AI</h2>
      <p>To read bills, receipts and screenshots we may send their text or image to Google's Gemini API. That includes the text of bill emails from the companies you chose, receipt photos you scan, and Splitwise screenshots you upload. Nothing else from your inbox is sent. Every amount it reads is shown to you to check before anyone sees a share. Google processes this data under its API terms.</p>
      <h2>What we don't collect</h2>
      <p>Bank logins, card numbers or payment credentials. {APP_NAME} doesn't move money.</p>
      <h2>Who can see it</h2>
      <p>Only members of a Space can see that Space's bills, shares and statements. Former members keep access to the history of bills they were part of.</p>
      <h2>Your choices</h2>
      <p>You can export a Space's records as CSV at any time, leave a Space, and turn off reminders. To delete your account, email {SUPPORT_EMAIL}.</p>
    </LegalPage>
  );
}
