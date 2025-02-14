/*
 * Parse a string range. Return an array containing
 * all parsed values. E.g. "3,4,6-9" will return [3,4,6,7,8,9].
 *
 * An incomplete range will assume `minVal` and `maxVal` are to
 * be used. E.g., "3-" == "3-<maxVal>".
 *
 * Based off of https://github.com/euank/node-parse-numeric-range
 */
export function parseRange(range: string, minVal = 0, maxVal = 100): number[] {
    function parsePart(part: string) {
        // just a number
        if (/^-?\d+$/.test(part)) {
            return [parseInt(part, 10)];
        }
        let m: RegExpMatchArray | null;
        // 1-5 or 1..5 (equivilant) or 1...5 (doesn't include 5)
        if (
            (m = part.match(/^(-?\d*)(-|\.\.\.?|\u2025|\u2026|\u22EF)(-?\d*)$/))
        ) {
            const lhs = parseInt(m[1]) || minVal;
            const sep = m[2];
            let rhs = parseInt(m[3]) || maxVal;
            if (lhs && rhs) {
                const res = [];
                const incr = lhs < rhs ? 1 : -1;

                // Make it inclusive by moving the right 'stop-point' away by one.
                if (sep === "-" || sep === ".." || sep === "\u2025") {
                    rhs += incr;
                }

                for (let i = lhs; i !== rhs; i += incr) {
                    res.push(i);
                }
                return res;
            }
        }
        return [];
    }
    const parts = range.split(",");

    const parsedRange = parts.reduce<number[]>(
        (acc, cur) => [...acc, ...parsePart(cur.trim())],
        []
    );

    return parsedRange;
}
