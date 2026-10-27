import { describe, expect, it } from "vitest";
import { keywordsForTyped, matchSource, parseSources, providersFor, senderAddress, sourceFromChoice, sourcesSearchQuery, STATE_OPTIONS, type BillSource } from "@/lib/domain/providers";

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
    expect(providersFor("OTHER", "electricity")).toEqual([]);
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
