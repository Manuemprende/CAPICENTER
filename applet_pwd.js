import fs from "fs";
import path from "path";
console.log(process.cwd());
console.log(fs.existsSync("/app/applet/server.ts"));
console.log(fs.readdirSync(process.cwd()));
