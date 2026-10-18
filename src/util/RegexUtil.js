const RegexUtil = Object.freeze({
    _regexEscapeRegex: /[.*+?^${}()|[\]\\]/g,
    escapeRegex: str => {
        return str.replace(RegexUtil._regexEscapeRegex, "\\$&");
    },

    flagsRegex: /^[gimsuy]*$/,

    validFlags: flags => {
        return typeof flags === "string" && RegexUtil.flagsRegex.test(flags) && new Set(flags).size === flags.length;
    },

    getMergedRegex: exps => {
        exps = Array.isArray(exps) ? exps.filter(exp => exp instanceof RegExp || exp?.constructor?.name === "RE2") : [];

        if (exps.length < 1) {
            return null;
        }

        const regexCtor = exps[0].constructor;

        const expText = `(?:${exps.map(exp => exp.source).join(")|(?:")})`,
            expFlags = [...new Set(exps.map(exp => exp.flags).join(""))].join("");

        return new regexCtor(expText, expFlags);
    },

    _substituteRegex: /\$([$&`']|\d{1,2}|<([^>]+)>)/g,

    _evaluateReplacement: (replacement, match, str) => {
        if (typeof replacement === "function") {
            return replacement(match[0], ...match.slice(1), match.index, str);
        }

        if (typeof replacement !== "string" || !replacement.includes("$")) {
            return String(replacement ?? "");
        }

        return replacement.replace(RegexUtil._substituteRegex, (fullToken, token, groupName) => {
            if (token === "$") {
                return "$";
            } else if (token === "&") {
                return match[0];
            } else if (token === "`") {
                return str.slice(0, match.index);
            } else if (token === "'") {
                return str.slice(match.index + match[0].length);
            } else if (groupName && match.groups) {
                return match.groups[groupName] ?? "";
            }

            const num = Number(token);

            if (!Number.isNaN(num) && num > 0 && num < match.length) {
                return match[num] ?? "";
            }

            return fullToken;
        });
    },

    multipleReplace: (str, rules = []) => {
        if (rules.length < 1) {
            return str;
        }

        const regexCtor = rules[0][0].constructor;

        const ruleEntries = rules.map(([regex, replacement], idx) => {
            const isGlobal = regex.flags.includes("g"),
                newFlags = [...new Set(regex.flags + "g")].join("");

            return {
                idx,
                regex,
                replacement,
                isGlobal,
                scanner: new regexCtor(regex.source, newFlags)
            };
        });

        const activeRules = new Set(ruleEntries),
            out = [];

        let cursor = 0;

        while (cursor < str.length && activeRules.size > 0) {
            let bestMatch = null,
                bestRule = null;

            for (const rule of activeRules) {
                rule.scanner.lastIndex = cursor;
                const match = rule.scanner.exec(str);

                if (match === null) {
                    activeRules.delete(rule);
                    continue;
                }

                const isEarlier = bestMatch === null || match.index < bestMatch.index,
                    isTieBreak = bestMatch !== null && match.index === bestMatch.index && rule.idx < bestRule.idx;

                if (isEarlier || isTieBreak) {
                    bestMatch = match;
                    bestRule = rule;

                    if (bestMatch.index === cursor && bestRule.idx === 0) {
                        break;
                    }
                }
            }

            if (bestMatch === null) {
                break;
            }

            out.push(str.slice(cursor, bestMatch.index));
            out.push(RegexUtil._evaluateReplacement(bestRule.replacement, bestMatch, str));

            const matchLength = Math.max(bestMatch[0].length, 1);
            cursor = bestMatch.index + matchLength;

            if (!bestRule.isGlobal) {
                activeRules.delete(bestRule);
            }
        }

        out.push(str.slice(cursor));
        return out.join("");
    }
});

export default RegexUtil;
