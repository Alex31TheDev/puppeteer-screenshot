import path from "node:path";

import Util from "../util/Util.js";

import ConfigError from "../errors/ConfigError.js";

class Schema {
    constructor(fields = {}) {
        this.fields = fields;
    }

    validate(raw, name = "") {
        return this._validateObject(raw, this.fields, name);
    }

    static _getDefault(defaultValue) {
        if (typeof defaultValue === "function") {
            return defaultValue();
        }

        if (Array.isArray(defaultValue)) {
            return [...defaultValue];
        }

        if (typeof defaultValue === "object" && defaultValue !== null) {
            return { ...defaultValue };
        }

        return defaultValue;
    }

    static _string(val, name, def = {}) {
        const optional = def.optional ?? false,
            allowEmpty = def.allowEmpty ?? false;

        if (optional && (typeof val === "undefined" || val === null || val === "")) {
            return null;
        }

        if (typeof val !== "string" || (!allowEmpty && val.trim().length === 0)) {
            throw new ConfigError(`Configuration value "${name}" must be a non-empty string`);
        }

        return val.trim();
    }

    static _path(val, name, def = {}) {
        const str = Schema._string(val, name, def);

        if (str === null) {
            return null;
        }

        return path.resolve(process.cwd(), str);
    }

    static _boolean(val, name) {
        if (typeof val !== "boolean") {
            throw new ConfigError(`Configuration value "${name}" must be a boolean`);
        }

        return val;
    }

    static _integer(val, name, def = {}) {
        const min = def.min ?? -Infinity,
            max = def.max ?? Infinity;

        if (!Number.isInteger(val) || val < min || val > max) {
            throw new ConfigError(`Configuration value "${name}" must be an integer between ${min} and ${max}`);
        }

        return val;
    }

    static _number(val, name, def = {}) {
        const min = def.min ?? -Infinity,
            max = def.max ?? Infinity;

        if (!Number.isFinite(val) || val < min || val > max) {
            throw new ConfigError(`Configuration value "${name}" must be a number between ${min} and ${max}`);
        }

        return val;
    }

    static _array(val, name, def = {}) {
        const itemType = def.itemType ?? "string",
            unique = def.unique ?? false;

        if (!Array.isArray(val)) {
            throw new ConfigError(`Configuration value "${name}" must be an array of non-empty strings`);
        }

        if (itemType === "string") {
            if (!val.every(item => typeof item === "string" && item.trim().length > 0)) {
                throw new ConfigError(`Configuration value "${name}" must be an array of non-empty strings`);
            }

            const items = val.map(item => item.trim());

            return Object.freeze(unique ? [...new Set(items)] : items);
        }

        return Object.freeze([...val]);
    }

    _validateField(val, name, def) {
        if (typeof val === "undefined") {
            if (typeof def.default !== "undefined") {
                val = Schema._getDefault(def.default);
            } else if (def.type === "object" && typeof def.schema === "object") {
                val = {};
            } else if (def.optional) {
                return null;
            } else {
                throw new ConfigError(`Configuration value "${name}" is required`);
            }
        }

        switch (def.type) {
            case "string":
                return Schema._string(val, name, def);
            case "path":
                return Schema._path(val, name, def);
            case "boolean":
                return Schema._boolean(val, name);
            case "integer":
                return Schema._integer(val, name, def);
            case "number":
                return Schema._number(val, name, def);
            case "array":
                return Schema._array(val, name, def);
            case "object":
                if (typeof def.schema === "object") {
                    return this._validateObject(val, def.schema, name);
                }

                if (val === null || Array.isArray(val) || typeof val !== "object") {
                    throw new ConfigError(`Configuration value "${name}" must be an object`);
                }

                return Object.freeze({ ...val });

            default:
                return val;
        }
    }

    _validateObject(raw, fields, name = "") {
        if (raw === null || Array.isArray(raw) || typeof raw !== "object") {
            if (Util.nonemptyString(name)) {
                throw new ConfigError(`Configuration value "${name}" must be an object`);
            }

            throw new ConfigError("Configuration must be an object");
        }

        const res = {};

        for (const [key, def] of Object.entries(fields)) {
            const fieldName = Util.nonemptyString(name) ? `${name}.${key}` : key;

            res[key] = this._validateField(raw[key], fieldName, def);
        }

        return Object.freeze(res);
    }
}

export default Schema;
