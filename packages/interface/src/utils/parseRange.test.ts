import { describe, expect, it } from 'vitest';
import { parseRange } from './parseRange';

function peq(x: string, y: number[]) {
    expect(parseRange(x)).to.eql(y);
}

describe('parseRange', function () {
    it('should parse 1', function () {
        peq('1', [1]);
    });
    it('should parse 1,1', function () {
        peq('1,1', [1, 1]);
    });
    it('should parse 1-5', function () {
        peq('1-5', [1, 2, 3, 4, 5]);
    });
    it('should parse 5-1', function () {
        peq('5-1', [5, 4, 3, 2, 1]);
    });
    it('should parse 1-3,5-6', function () {
        peq('1-3,5-6', [1, 2, 3, 5, 6]);
    });
    it('should parse ""', function () {
        peq('', []);
    });
    it('should parse ranges with a space in between', function () {
        peq('1-2, 3-4', [1, 2, 3, 4]);
    });
    it('should parse mixed ranges and integers', function () {
        peq('1-2, 5, 3-4, 8', [1, 2, 5, 3, 4, 8]);
    });
    it('should parse mixed integers and ranges', function () {
        peq('1, 2-5, 4-8, 3', [1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 3]);
    });
    it('should parse ranges without start specified', function () {
        peq('-5', [1, 2, 3, 4, 5]);
    });
    it('should parse ranges without end specified', function () {
        peq('95-', [95, 96, 97, 98, 99, 100]);
    });
});
