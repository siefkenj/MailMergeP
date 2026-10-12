import { describe, expect, it, vi } from "vitest";
import { fillTemplate } from "../utils";
import type { Email } from "../types/modelTypes";

const SPREADSHEET = [
    ["first", "last", "title", "email", "paid", "amount", "items", "html"],
    [
        "Alice",
        "Smith",
        "Dr",
        " Alice@Example.com ",
        "",
        "200",
        "a,b,c",
        "Tom & <Jerry>",
    ],
];

function render(subject: string, method?: string) {
    const [email] = fillTemplate({ subject }, SPREADSHEET, method);
    return email.subject;
}

describe("fillTemplate", () => {
    it("can't use eval or new Function (as in Thunderbird)", () => {
        // vitest.config.ts runs the tests with eval disabled, like Thunderbird's CSP
        expect(() => new Function("return 1")).toThrow(EvalError);
    });

    // Expected values are the output of nunjucks, which MailMergeP used before
    it.each([
        ["Hi {{first}}", "Hi Alice"],
        ["Hi {{ first }}!", "Hi Alice!"],
        ["[{{ missing }}]", "[]"],
        ["{# note #}Hi {{first}}", "Hi Alice"],
        ["{% if title %}{{title}} {% endif %}{{last}}", "Dr Smith"],
        [
            "{% if title == 'Dr' %}Doctor{% elif title == 'Prof' %}Professor{% else %}Mx{% endif %}",
            "Doctor",
        ],
        ["{% if not paid %}Please pay{% endif %}", "Please pay"],
        ["{% if paid %}paid{% else %}unpaid{% endif %}", "unpaid"],
        ["{% if missing or first %}either{% endif %}", "either"],
        ["{{ first | upper }}", "ALICE"],
        ["{{ 'hello world' | title }}", "Hello World"],
        ["{{ email | trim | lower }}", "alice@example.com"],
        ["{{ first | length }}", "5"],
        ["{{ missing | default('friend') }}", "friend"],
        ["{{ first | replace('A', 'E') }}", "Elice"],
        ["{{ first ~ ' ' ~ last }}", "Alice Smith"],
        ["{% set full = first + ' ' + last %}{{ full }}", "Alice Smith"],
        ["{{ 'Dr. ' + last if title == 'Dr' else first }}", "Dr. Smith"],
        [
            "{% for x in ['a', 'b'] %}{{ loop.index }}{{ x }} {% endfor %}",
            "1a 2b ",
        ],
        ["{% for x in items.split(',') %}<{{ x }}>{% endfor %}", "<a><b><c>"],
        ["{% if amount | int > 100 %}big{% endif %}", "big"],
        ["{{ amount | int + 1 }}", "201"],
        // Values are not HTML-escaped
        ["<p>{{ html }}</p>", "<p>Tom & <Jerry></p>"],
    ])("renders %s", (template, expected) => {
        expect(render(template)).toBe(expected);
    });

    // Whitespace around tags is kept, as in nunjucks (no trim_blocks/lstrip_blocks)
    it.each([
        [
            "Dear {{first}},\n\n{% if title %}\n  As a {{title}},\n{% endif %}\nThanks\n",
            "Dear Alice,\n\n\n  As a Dr,\n\nThanks\n",
        ],
        ["A\n{%- if title %}\nB\n{%- endif %}\nC", "A\nB\nC"],
        [
            "Line1\r\n{% if title %}Dr{% endif %}\r\nLine3",
            "Line1\r\nDr\r\nLine3",
        ],
    ])("keeps whitespace in %j", (template, expected) => {
        expect(render(template)).toBe(expected);
    });

    it("leaves a field unchanged if it can't be rendered", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(render("Hi {{ first")).toBe("Hi {{ first");
        expect(render("{{ first | nosuchfilter }}")).toBe(
            "{{ first | nosuchfilter }}"
        );
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("treats the old 'nunjucks' preference as Jinja", () => {
        expect(render("{{ first | upper }}", "nunjucks")).toBe("ALICE");
    });

    it("supports the legacy parser", () => {
        expect(render("Hi {{first}}", "legacy")).toBe("Hi Alice");
    });

    it("fills every field for every row, skipping blank rows", () => {
        const template: Email = {
            to: "{{email | trim}}",
            subject: "Hi {{first}}",
            body: "",
        };
        const emails = fillTemplate(template, [
            ["first", "email"],
            ["Alice", "alice@example.com"],
            ["", ""],
            ["Bob", "bob@example.com"],
        ]);
        expect(emails).toEqual([
            { to: "alice@example.com", subject: "Hi Alice" },
            { to: "bob@example.com", subject: "Hi Bob" },
        ]);
    });
});
