const messages = {
    undefined: "Use typeof checks instead of undefined comparisons.",
    rawError: "Use a repo error class instead of raw Error."
};

const undefinedSelectors = [
    "BinaryExpression[operator='==='] > Identifier[name='undefined']",
    "BinaryExpression[operator='!=='] > Identifier[name='undefined']"
];

const rawErrorSelectors = [
    "ThrowStatement > NewExpression[callee.name='Error']",
    "ThrowStatement > CallExpression[callee.name='Error']"
];

const makeRules = (selectors, message) => {
    return selectors.map(selector => ({
        selector,
        message
    }));
};

const undefinedRules = makeRules(undefinedSelectors, messages.undefined),
    rawErrorRules = makeRules(rawErrorSelectors, messages.rawError);

module.exports = {
    env: {
        node: true,
        es2023: true
    },
    extends: "eslint:recommended",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
    },
    plugins: ["unused-imports"],
    rules: {
        "no-unused-vars": "off",
        "unused-imports/no-unused-vars": [
            "warn",
            {
                vars: "all",
                varsIgnorePattern: "^(resolve|reject|_)$",
                args: "none"
            }
        ],
        "unused-imports/no-unused-imports": "error",
        "no-duplicate-imports": "error",
        "no-ex-assign": "off",
        "no-case-declarations": "off",
        "no-empty": "off",
        eqeqeq: ["error", "always", { null: "ignore" }],
        "no-restricted-syntax": ["error", ...undefinedRules, ...rawErrorRules],
        "no-template-curly-in-string": "warn",
        "object-shorthand": ["warn", "properties"],
        "require-await": "error"
    },
    globals: {
        tag: "writable",
        msg: "writable",
        util: "writable",
        http: "writable"
    }
};
