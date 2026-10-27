import { describe, expect, it } from "vitest";
import { groupBillSenders, keywordsForTyped, matchSource, parseSources, providersFor, senderAddress, senderName, sourceFromChoice, sourceFromSender, sourcesSearchQuery, STATE_OPTIONS, type BillSource } from "@/lib/domain/providers";

const chicago: BillSource[] = [
  sourceFromChoice("IL", "electricity", { providerId: "comed" })!,
  sourceFromChoice("IL", "gas", { providerId: "peoples-gas" })!,
  sourceFromChoice("IL", "internet", { providerId: "xfinity" })!,
];

describe("provider lists", () => {
  it("has the states asked for, with Chicago's companies", () => {
    expect(STATE_OPTIONS.map((s) => s.code)).toEqual(expect.arrayContaining(["IL", "CT", "TX"]));
    expect(providersFor("IL", "electricity")[0].name).toBe("ComEd");
    expect(providersFor("IL", "gas").map((p) => p.name)).toContain("Peoples Gas");
    expect(providersFor("CT", "gas").map((p) => p.id)).toContain("scg");
    expect(providersFor("TX", "electricity").map((p) => p.name)).toEqual(expect.arrayContaining(["Reliant", "TXU Energy"]));
  });
  it("any other state still gets national internet providers", () => {
    expect(providersFor("OTHER", "electricity").map((p) => p.id)).toEqual(["public-grid", "conservice"]);
    expect(providersFor("OTHER", "internet").map((p) => p.id)).toContain("tmobile-home");
  });
  it("every id is unique within a list", () => {
    for (const s of [...STATE_OPTIONS.map((x) => x.code), "OTHER"]) for (const c of ["electricity", "gas", "internet"] as const) {
      const ids = providersFor(s, c).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("Gmail search from chosen companies", () => {
  it("searches only those companies, quoting phrases", () => {
    expect(sourcesSearchQuery(chicago)).toBe('newer_than:90d from:(comed OR "peoples gas" OR peoplesgasdelivery OR xfinity OR comcast) -in:chats');
  });
  it("includes remembered exact senders", () => {
    expect(sourcesSearchQuery(chicago, [{ address: "ebill@peoplesgasdelivery.com", name: "Peoples Gas", category: "gas" }])).toContain("ebill@peoplesgasdelivery.com");
  });
  it("is null when nothing is chosen", () => {
    expect(sourcesSearchQuery([])).toBeNull();
  });
});

describe("matching a sender to a chosen company", () => {
  it("by name or address, whole words only", () => {
    expect(matchSource("ComEd <noreply@e.comed.com>", chicago)?.name).toBe("ComEd");
    expect(matchSource("Peoples Gas <customerservice@peoplesgasdelivery.com>", chicago)?.name).toBe("Peoples Gas");
    expect(matchSource("Xfinity <online.communications@alerts.comcast.net>", chicago)?.name).toBe("Xfinity (Comcast)");
    expect(matchSource("Becomedy Shop <hi@becomedy.com>", chicago)).toBeNull();
    expect(matchSource("Chase <alerts@chase.com>", chicago)).toBeNull();
  });
  it("uses remembered senders first", () => {
    expect(matchSource("Billing <bills@paymentus.com>", chicago, [{ address: "bills@paymentus.com", name: "Peoples Gas", category: "gas" }])?.name).toBe("Peoples Gas");
  });
  it("reads the address to remember", () => {
    expect(senderAddress("ComEd <NoReply@E.ComEd.com>")).toBe("noreply@e.comed.com");
    expect(senderAddress("nobody")).toBeNull();
  });
});

describe("billing services that send the bill instead of the utility", () => {
  it("Public Grid is pickable in every state and matches its real sender", () => {
    for (const st of ["IL", "CT", "TX", "OTHER"]) expect(providersFor(st, "electricity").map((p) => p.id)).toContain("public-grid");
    const pg = [sourceFromChoice("IL", "electricity", { providerId: "public-grid" })!];
    expect(matchSource("Public Grid Team <support@onepublicgrid.com>", pg)?.name).toBe("Public Grid");
    expect(sourcesSearchQuery(pg)).toContain('"public grid" OR onepublicgrid');
  });
  it("typing it in also works", () => {
    const typed = [sourceFromChoice("IL", "electricity", { typed: "Public Grid" })!];
    expect(matchSource("Public Grid Team <support@onepublicgrid.com>", typed)?.name).toBe("Public Grid");
  });
});

describe("typed companies", () => {
  it("search by the full name and one distinctive word", () => {
    expect(keywordsForTyped("City of Evanston Water")).toEqual(["city of evanston water", "evanston"]);
    expect(keywordsForTyped("SCG")).toEqual(["scg"]);
    expect(sourceFromChoice("CT", "gas", { typed: "  " })).toBeNull();
  });
});

describe("parseSources", () => {
  it("drops unknown ids and rejects bad input", () => {
    expect(parseSources("IL", [{ category: "gas", providerId: "not-real" }])).toEqual([]);
    expect(parseSources("IL", [{ category: "water", providerId: "x" }])).toBeNull();
    expect(parseSources("IL", "nope")).toBeNull();
    expect(parseSources("IL", [{ category: "electricity", providerId: "comed" }])?.[0].name).toBe("ComEd");
  });
});

describe("Find my bills in Gmail", () => {
  const inbox = [
    { from: "Public Grid Team <support@onepublicgrid.com>", subject: "Your Electric bill is ready", date: "2026-10-06" },
    { from: "Public Grid Team <support@onepublicgrid.com>", subject: "Your Electric bill is ready", date: "2026-09-06" },
    { from: "City of Chicago <utilitybilling@cityofchicago.org>", subject: "Your water bill is available", date: "2026-09-20" },
    { from: "Xfinity <online.communications@alerts.comcast.net>", subject: "Exclusive offer: save $20 on your bill", date: "2026-10-01" },
    { from: "Mom <mom@gmail.com>", subject: "dinner sunday?", date: "2026-10-02" },
    { from: "Chase <no.reply.alerts@chase.com>", subject: "Your statement is ready", date: "2026-10-03" },
  ];

  it("groups bill emails by sender, most frequent first, without marketing", () => {
    const found = groupBillSenders(inbox);
    expect(found.map((f) => [f.name, f.count])).toEqual([["Public Grid Team", 2], ["Chase", 1], ["City of Chicago", 1]]);
  });

  it("leaves out senders already chosen", () => {
    const pg = sourceFromSender("Public Grid Team", "support@onepublicgrid.com")!;
    expect(groupBillSenders(inbox, [pg]).map((f) => f.address)).not.toContain("support@onepublicgrid.com");
  });

  it("a ticked sender is matched by its exact address", () => {
    const pg = sourceFromSender("Public Grid Team", "support@onepublicgrid.com")!;
    expect(pg).toEqual({ category: "other", providerId: null, name: "Public Grid Team", keywords: ["support@onepublicgrid.com"] });
    expect(matchSource("Public Grid Team <support@onepublicgrid.com>", [pg])?.category).toBe("other");
    expect(matchSource("Someone <other@onepublicgrid.com>", [pg])).toBeNull();
    expect(sourcesSearchQuery([pg])).toBe("newer_than:90d from:(support@onepublicgrid.com) -in:chats");
  });

  it("validates ticked senders from the browser", () => {
    expect(parseSources("IL", [{ category: "other", typed: "Public Grid", address: "support@onepublicgrid.com" }])?.[0].keywords).toEqual(["support@onepublicgrid.com"]);
    expect(parseSources("IL", [{ category: "other", typed: "x", address: "not an email" }])).toBeNull();
  });

  it("reads display names", () => {
    expect(senderName('"Public Grid Team" <support@onepublicgrid.com>')).toBe("Public Grid Team");
    expect(senderName("support@onepublicgrid.com")).toBe("");
  });
});
