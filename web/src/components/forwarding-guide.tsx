import { CopyField } from "./copy-field";
import { Notice } from "./ui";

/**
 * Plain steps for getting bills into a Space by email. Gmail's auto-forward can't be set up from
 * the phone app, so the steps say so. We recommend a filter (only the bills you choose), never
 * forwarding the whole inbox.
 */
export function ForwardingGuide({
  address,
  code,
}: {
  address: string;
  code: { code: string; receivedAt: string } | null;
}) {
  const fresh =
    code &&
    Date.now() - new Date(code.receivedAt).getTime() < 3 * 24 * 60 * 60 * 1000
      ? code
      : null;
  return (
    <div className="space-y-4">
      {fresh && (
        <Notice tone="brand" title="Gmail sent a confirmation code">
          <p className="mb-2">
            Type this code into Gmail's settings to finish step 3 below.
          </p>
          <CopyField label="Confirmation code" value={fresh.code} mono />
        </Notice>
      )}

      <Step title="Forward one bill">
        <ol className="list-decimal pl-5 space-y-1.5 marker:text-muted">
          <li>Open the bill email.</li>
          <li>
            Tap the three dots, then <b>Forward</b>.
          </li>
          <li>
            Paste the address above and send. Add the PDF if there is one.
          </li>
        </ol>
      </Step>

      <Step title="Forward bills automatically in Gmail">
        <p className="text-[13px] text-muted mb-2">
          Do this on a computer. The Gmail phone app can't set it up.
        </p>
        <ol className="list-decimal pl-5 space-y-2 marker:text-muted">
          <li>Copy the address above.</li>
          <li>
            In Gmail, click the gear icon, then <b>See all settings</b>, then
            the <b>Forwarding and POP/IMAP</b> tab.
          </li>
          <li>
            Click <b>Add a forwarding address</b>, paste the address and
            confirm. Gmail sends a confirmation code to this Space. It shows up
            on this page within a minute or two. Type it into Gmail.
          </li>
          <li>
            Open the <b>Filters and Blocked Addresses</b> tab and click{" "}
            <b>Create a new filter</b>.
          </li>
          <li>
            In <b>From</b>, type your provider, like ComEd or Peoples Gas, then
            click <b>Create filter</b>.
          </li>
          <li>
            Tick <b>Forward it to</b>, pick this Space's address, then click{" "}
            <b>Create filter</b>. Repeat for each provider.
          </li>
        </ol>
        <p className="text-[13px] text-muted mt-3">
          Don't turn on "Forward a copy of incoming mail" for everything. A
          filter sends only the bills you pick, and you can delete it anytime.
        </p>
      </Step>

      <p className="text-[13px] text-muted">
        Using Outlook, Yahoo or Apple Mail? Forward one bill at a time to the
        address above, or upload the PDF.
      </p>
      <span className="sr-only">Address: {address}</span>
    </div>
  );
}

function Step({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[14px] ring-1 ring-line bg-surface"
    >
      <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3 px-4 py-3 text-[15px] font-medium">
        {title}
        <svg
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
          width="12"
          height="8"
          viewBox="0 0 12 8"
          aria-hidden="true"
        >
          <path
            d="M1 1.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </summary>
      <div className="px-4 pb-4 text-[14px] text-ink-2">{children}</div>
    </details>
  );
}
