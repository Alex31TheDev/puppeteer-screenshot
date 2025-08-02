import bcrypt from "bcrypt";

const args = process.argv.slice(2);

let password, username;

if (args.length >= 2) {
    password = args[1];
    username = args[0];
} else {
    password = args[0];
    username = "placeholder";
}

if (typeof password !== "string" || password.length < 1) {
    console.error("ERROR: No password provided.");
    process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10),
    lastUpdated = new Date().toISOString();

console.log(
    JSON.stringify(
        {
            username,
            password: passwordHash,
            lastUpdated
        },
        undefined,
        4
    )
);
