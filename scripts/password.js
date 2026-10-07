import bcrypt from "bcrypt";

const [username, password] = process.argv.slice(2);

if (typeof username !== "string" || username.length === 0 || typeof password !== "string" || password.length === 0) {
    console.error("ERROR: Username and password are required.");
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
