import { describe, expect, it } from "vitest";
import { fillTemplate, hasTemplateErrors, normalizePrefs } from "../utils";
import type { Email, Prefs } from "../types/modelTypes";

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

// Render `subject` for the first row, expecting no errors
function render(subject: string, method?: Prefs["parser"]) {
    const { emails, errors } = fillTemplate({ subject }, SPREADSHEET, method);
    expect(errors).toEqual([{}]);
    return emails[0].subject;
}

// Render `subject` for a row of `spreadsheet`, returning the result and any error
function renderWithError(subject: string, spreadsheet = SPREADSHEET) {
    const { emails, errors } = fillTemplate({ subject }, spreadsheet);
    return { subject: emails[0].subject, error: errors[0].subject };
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

    it.each([
        // Can't be parsed
        ["Hi {{ first", /./],
        ["{{ first | nosuchfilter }}", /nosuchfilter/],
        // Uses a column that doesn't exist. (nunjucks rendered these as if the column
        // were empty, which hides typos.)
        ["Dear {{ title2 ~ ' ' ~ last }}", /undefined/],
        ["Hi {{ nickname | trim }}", /UndefinedValue/],
    ])(
        "reports an error and leaves the field unchanged for %s",
        (template, message) => {
            const { subject, error } = renderWithError(template);
            expect(subject).toBe(template);
            expect(error).toMatch(message);
        }
    );

    it("ignores columns whose names Jinja reserves, unless they're used", () => {
        const spreadsheet = [
            ["first", "range", "none", "True", "namespace"],
            ["Alice", "1-5", "x", "y", "z"],
        ];
        // These names make @huggingface/jinja throw if passed as variables
        expect(renderWithError("Hi {{ first }}", spreadsheet)).toEqual({
            subject: "Hi Alice",
            error: undefined,
        });
        // A template using one would get Jinja's `range` function, not the column
        expect(
            renderWithError("{{ first }}: {{ range }}", spreadsheet)
        ).toEqual({
            subject: "{{ first }}: {{ range }}",
            error: 'The column name "range" can\'t be used in templates. Rename the column.',
        });
    });

    it("reports errors per email, so other emails are still filled in", () => {
        const { emails, errors } = fillTemplate(
            { subject: "{{ amount | int + 1 }}" },
            [["amount"], ["1"], ["x"]]
        );
        expect(emails).toEqual([{ subject: "2" }, { subject: "1" }]);
        expect(errors).toEqual([{}, {}]);

        const result = fillTemplate({ subject: "Hi {{ name | trim }}" }, [
            ["name", "other"],
            ["Alice", ""],
            ["", "x"],
        ]);
        expect(result.emails[0]).toEqual({ subject: "Hi Alice" });
        expect(hasTemplateErrors(result.errors)).toBe(false);
    });

    it("supports the legacy parser, which never reports errors", () => {
        expect(render("Hi {{first}}", "legacy")).toBe("Hi Alice");
        expect(render("Hi {{ first", "legacy")).toBe("Hi {{ first");
    });

    it("fills every field for every row, skipping blank rows", () => {
        const template: Email = {
            to: "{{email | trim}}",
            subject: "Hi {{first}}",
            body: "",
        };
        const { emails, errors } = fillTemplate(template, [
            ["first", "email"],
            ["Alice", "alice@example.com"],
            ["", ""],
            ["Bob", "bob@example.com"],
        ]);
        expect(emails).toEqual([
            { to: "alice@example.com", subject: "Hi Alice" },
            { to: "bob@example.com", subject: "Hi Bob" },
        ]);
        expect(errors).toEqual([{}, {}]);
    });
});

describe("hasTemplateErrors", () => {
    it("is true if any field of any email has an error", () => {
        expect(hasTemplateErrors([])).toBe(false);
        expect(hasTemplateErrors([{}, {}])).toBe(false);
        expect(hasTemplateErrors([{}, { body: "oops" }])).toBe(true);
    });
});

describe("normalizePrefs", () => {
    it("treats the 'nunjucks' parser saved by older versions as Jinja", () => {
        expect(normalizePrefs({ parser: "nunjucks", delay: 1 })).toEqual({
            parser: "jinja",
            delay: 1,
        });
        expect(normalizePrefs({ parser: "legacy" })).toEqual({
            parser: "legacy",
        });
        expect(normalizePrefs({ delay: 1 })).toEqual({ delay: 1 });
    });
});
