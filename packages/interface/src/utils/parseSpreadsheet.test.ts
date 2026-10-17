import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { parseSpreadsheet } from "../utils";

const CSV =
    "name,email,joined,zip\n" +
    "José Müller,jose@example.com,2024-01-15,02139\n" +
    "Françoise Ñúñez,fr@example.com,1/15/2024,00501\n";
const EXPECTED = [
    ["name", "email", "joined", "zip"],
    ["José Müller", "jose@example.com", "2024-01-15", "02139"],
    ["Françoise Ñúñez", "fr@example.com", "1/15/2024", "00501"],
];

function bytes(data: ArrayLike<number> | ArrayBuffer) {
    return Array.from(new Uint8Array(data as ArrayBuffer));
}

function utf16le(str: string) {
    const ret = [0xff, 0xfe];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        ret.push(code & 0xff, code >> 8);
    }
    return ret;
}

function binarySpreadsheet(bookType: XLSX.BookType) {
    const sheet = XLSX.utils.aoa_to_sheet(
        [
            ["name", "joined"],
            ["José Müller", new Date(Date.UTC(2024, 0, 15))],
        ],
        { cellDates: true }
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
    return bytes(XLSX.write(book, { type: "array", bookType }));
}

describe("parseSpreadsheet", () => {
    const warn = vi.spyOn(console, "warn");
    vi.spyOn(console, "log").mockImplementation(() => {});
    afterEach(() => {
        // Every input here is valid, so no parsing attempt should fail
        const warnings = [...warn.mock.calls];
        warn.mockClear();
        expect(warnings).toEqual([]);
    });

    it("returns an empty sheet for empty data", () => {
        expect(parseSpreadsheet([])).toEqual([[]]);
    });

    it("parses UTF-8 CSV, keeping values exactly as written", () => {
        expect(parseSpreadsheet(bytes(new TextEncoder().encode(CSV)))).toEqual(
            EXPECTED
        );
    });

    it("strips a UTF-8 byte order mark", () => {
        const data = bytes(new TextEncoder().encode("\ufeff" + CSV));
        expect(parseSpreadsheet(data)).toEqual(EXPECTED);
    });

    it("parses UTF-8 TSV", () => {
        const data = bytes(new TextEncoder().encode(CSV.replace(/,/g, "\t")));
        expect(parseSpreadsheet(data)).toEqual(EXPECTED);
    });

    it("parses UTF-16 tab separated text (Excel's 'Unicode Text' export)", () => {
        const data = utf16le(CSV.replace(/,/g, "\t"));
        expect(parseSpreadsheet(data)).toEqual(EXPECTED);
    });

    it("parses windows-1252 CSV", () => {
        // "Zoë,“Price” €5" encoded as windows-1252
        const data = [
            ...bytes(new TextEncoder().encode("name,note\nZo")),
            0xeb,
            0x2c,
            0x93,
            ...bytes(new TextEncoder().encode("Price")),
            0x94,
            0x20,
            0x80,
            0x35,
            0x0a,
        ];
        expect(parseSpreadsheet(data)).toEqual([
            ["name", "note"],
            ["Zoë", "“Price” €5"],
        ]);
    });

    it.each<XLSX.BookType>(["xlsx", "ods", "biff8"])(
        "parses %s with date cells",
        (bookType) => {
            expect(parseSpreadsheet(binarySpreadsheet(bookType))).toEqual([
                ["name", "joined"],
                ["José Müller", new Date(Date.UTC(2024, 0, 15))],
            ]);
        }
    );
});
