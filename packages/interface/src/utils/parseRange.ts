/*
 * Parse a string range. Return an array containing
 * all parsed values. E.g. "3,4,6-9" will return [3,4,6,7,8,9].
 *
 * An incomplete range will assume `minVal` and `maxVal` are to
 * be used. E.g., "3-" == "3-<maxVal>" and "-5" == "<minVal>-5"
 *
 * Based off of https://github.com/euank/node-parse-numeric-range
 */
export function parseRange(range: string, minVal = 1, maxVal = 100): number[] {
    function parsePart(part: string) {
        // Just a number
        if (/^-?\d+$/.test(part)) {
            const num = parseInt(part, 10);
            // Negative value signify a range without start specified e.g. "-5" is parsed as "<minVal>-5"
            if (num < 0) {
                return parsePart(`${minVal}-${Math.abs(num)}`);
            }
            return [parseInt(part, 10)];
        }
        const m = part.match(/^(-?\d*)(-)(-?\d*)$/);
        if (m) {
            const lhs = parseInt(m[1]) || minVal;
            const sep = m[2];
            let rhs = parseInt(m[3]) || maxVal;
            if (lhs && rhs) {
                const res = [];
                const incr = lhs < rhs ? 1 : -1;

                // Make it inclusive by moving the right 'stop-point' away by one.
                if (sep === "-") {
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
