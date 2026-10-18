import test from "node:test";
import assert from "node:assert/strict";
import RE2 from "re2";

import RegexUtil from "../src/util/RegexUtil.js";

test("RegexUtil.escapeRegex escapes regex special characters", () => {
    const raw = "hello.world*foo?bar+baz(qux)[test]{1,2}^end$|slash\\pipe";
    const escaped = RegexUtil.escapeRegex(raw);

    assert.equal(escaped, "hello\\.world\\*foo\\?bar\\+baz\\(qux\\)\\[test\\]\\{1,2\\}\\^end\\$\\|slash\\\\pipe");
    const regex = new RegExp(escaped);
    assert.equal(regex.test(raw), true);
});

test("RegexUtil.validFlags correctly identifies valid and invalid flags", () => {
    assert.equal(RegexUtil.validFlags("i"), true);
    assert.equal(RegexUtil.validFlags("gi"), true);
    assert.equal(RegexUtil.validFlags("gimsuy"), true);
    assert.equal(RegexUtil.validFlags(""), true);

    // Duplicates
    assert.equal(RegexUtil.validFlags("gg"), false);
    assert.equal(RegexUtil.validFlags("gii"), false);

    // Invalid characters
    assert.equal(RegexUtil.validFlags("x"), false);
    assert.equal(RegexUtil.validFlags("gx"), false);
    assert.equal(RegexUtil.validFlags(null), false);
    assert.equal(RegexUtil.validFlags(123), false);
});

test("RegexUtil.getMergedRegex combines multiple regexes into one with deduplicated flags", () => {
    const exp1 = new RE2("foo", "i"),
        exp2 = new RE2("bar", "g");

    const merged = RegexUtil.getMergedRegex([exp1, exp2]);
    assert.notEqual(merged, null);
    assert.equal(merged.constructor, RE2);
    assert.equal(merged.source, "(?:foo)|(?:bar)");
    assert.equal(merged.flags.includes("i"), true);
    assert.equal(merged.flags.includes("g"), true);

    assert.equal(merged.test("FOO"), true);
    merged.lastIndex = 0;
    assert.equal(merged.test("bar"), true);
    merged.lastIndex = 0;
    assert.equal(merged.test("baz"), false);
});

test("RegexUtil.getMergedRegex returns null for empty or invalid input", () => {
    assert.equal(RegexUtil.getMergedRegex([]), null);
    assert.equal(RegexUtil.getMergedRegex(null), null);
    assert.equal(RegexUtil.getMergedRegex(["not", "regex"]), null);
});

test("RegexUtil.multipleReplace handles empty rules", () => {
    const str = "hello world";
    assert.equal(RegexUtil.multipleReplace(str, []), str);
});

test("RegexUtil.multipleReplace performs multiple simultaneous replacements without re-scanning", () => {
    const rules = [
        [new RE2("a", "g"), "b"],
        [new RE2("b", "g"), "c"]
    ];

    // If sequential: "a" -> "b" -> "c". But multipleReplace replaces simultaneously: "a" becomes "b", "b" becomes "c".
    const res = RegexUtil.multipleReplace("ab", rules);
    assert.equal(res, "bc");
});

test("RegexUtil.multipleReplace respects global vs non-global flags", () => {
    const rules = [
        [new RE2("a"), "X"],
        [new RE2("b", "g"), "Y"]
    ];

    const res = RegexUtil.multipleReplace("a a b b", rules);
    assert.equal(res, "X a Y Y");
});

test("RegexUtil.multipleReplace breaks ties by rule order", () => {
    const rules = [
        [new RE2("foo", "g"), "FIRST"],
        [new RE2("foobar", "g"), "SECOND"]
    ];

    // "foo" comes first at index 0
    const res = RegexUtil.multipleReplace("foobar", rules);
    assert.equal(res, "FIRSTbar");
});

test("RegexUtil.multipleReplace evaluates substitution tokens", () => {
    const rules = [
        [new RE2("(\\w+)-(\\w+)", "g"), "$2-$1"],
        [new RE2("test", "g"), "[$&]"]
    ];

    const res = RegexUtil.multipleReplace("foo-bar and test", rules);
    assert.equal(res, "bar-foo and [test]");
});
