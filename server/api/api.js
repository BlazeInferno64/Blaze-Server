import express from "express";
const router = express.Router();
import helmet from "helmet";
import cors from "cors";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import ejs from "ejs";
import blazed from "blazed.js";
import dns from "dns/promises";
//import UserAgent from 'user-agents';

blazed.registerGlobals();


import { isPrivateIp } from "../tools/dns.js";

const __dirname = import.meta.dirname;

const packageJsonFilePath = path.join(__dirname, "..", "..", "./package.json");
const jsonData = fs.readFileSync(packageJsonFilePath, "utf-8");
const parsedJSONData = JSON.parse(jsonData);


const obj = blazed.configure({
    "headers": {
        "X-Requested-With": false,
    }
});

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 45,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: {
        status: 'failed',
        message: `Whoa! You just triggered the rate limit of this rest api! Please try again later`,
    }
})

router.use(express.urlencoded({ extended: false }));
router.use(express.json());
router.use(express.raw());
router.use(express.text());
router.use(helmet());
router.use(helmet({
    contentSecurityPolicy: {
        directives: {
            imgSrc: ["'self'", "data:", "https://avatars.githubusercontent.com"]
        },
    },
}));
router.use(limiter);
router.use("/users", cors({
    origin: "*"
}));
router.use("/ip", cors({
    origin: "*"
}));
router.use("/proxy", cors({
    origin: "*",
}));
router.use((req, res, next) => {
    res.set("X-Api-Version", parsedJSONData.version);
    return next();
});

router.get("/", (req, res) => {
    return res.json({
        status: 'success',
        message: `For api usage please check https://blazeinferno64.github.io/#api`
    });
})

let decodeUrl;

router.all("/proxy", async (req, res) => {
    try {
        const rawUrl = req.query.url || req.params.url;
        const timeout = req.query.timeout;

        if (!rawUrl) {
            return res.status(400).json({ status: "failed", message: "Empty URL" });
        }

        // 1. URL DECODING & PROTOCOL CHECK
        let decodeUrl;
        try {
            decodeUrl = decodeURIComponent(rawUrl);
        } catch {
            return res.status(400).json({ status: "failed", message: "Invalid URL encoding" });
        }

        let target;
        try {
            target = new URL(decodeUrl);
        } catch {
            return res.status(400).json({ status: "failed", message: "Invalid URL" });
        }

        if (!["http:", "https:"].includes(target.protocol)) {
            return res.status(400).json({ status: "failed", message: "Invalid protocol" });
        }

        const hostname = target.hostname;

        // 2. SSRF PROTECTION (BLOCK PRIVATE NETWORKS)
        const blockedHosts = ["localhost", "0.0.0.0", "127.0.0.1"];
        if (blockedHosts.includes(hostname) || hostname.includes(":")) {
            return res.status(403).json({ status: "failed", message: "Restricted host" });
        }

        const privateIpPatterns = [
            /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[0-1])\./
        ];

        if (privateIpPatterns.some(r => r.test(hostname))) {
            return res.status(403).json({ status: "failed", message: "Private IP blocked" });
        }

        // DNS Level SSRF Check (Prevents DNS Rebinding)
        const records = await dns.lookup(hostname, { all: true });
        if (records.some(r => isPrivateIp(r.address))) {
            return res.status(403).json({ status: "failed", message: "Access Denied: Private IP" });
        }

        // 3. HEADER CLEANING & ANTI-BOT FINGERPRINTING
        const incomingHeaders = Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])
        );

        const safeHeaders = {};
        const allowedKeys = ['accept', 'accept-language', 'cookie', 'content-type'];
        allowedKeys.forEach(key => {
            if (incomingHeaders[key]) safeHeaders[key] = incomingHeaders[key];
        });

        const controller = new AbortController();
        const timeoutMs = timeout ? parseInt(timeout) : 8000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const startTime = Date.now();

        let fetchOptions = {
            method: req.method,
            headers: {
                ...safeHeaders,
                "host": target.host,
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "connection": "keep-alive",
                "upgrade-insecure-requests": "1",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            },
            signal: controller.signal,
            redirect: "follow",
        };

        if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
            fetchOptions.body = typeof req.body === "object"
                ? JSON.stringify(req.body)
                : req.body;
        }

        const response = await fetch(decodeUrl, fetchOptions);
        clearTimeout(timer);

        const duration = Date.now() - startTime;
        const responseHeaders = Object.fromEntries(response.headers.entries());
        const contentType = response.headers.get("content-type") || "";

        // 4. DATA HANDLING — decode based on content type
        let data;
        if (contentType.includes("application/json")) {
            data = await response.json();
        } else if (
            contentType.includes("text/") ||
            contentType.includes("application/xml") ||
            contentType.includes("application/javascript")
        ) {
            data = await response.text();
        } else {
            // Binary (images, fonts, etc.) — encode as base64
            const buffer = await response.arrayBuffer();
            data = Buffer.from(buffer).toString("base64");
        }

        const responseSize = Buffer.byteLength(
            typeof data === "string" ? data : JSON.stringify(data),
            "utf-8"
        );

        // 5. RETURN RESPONSE
        return res.json({
            status: "success",
            message: {
                data,
                duration,
                responseSize,
                responseHeaders,
                statusCode: response.status,
                contentType,
            }
        });

    } catch (err) {
        console.error("Proxy Error:", err.message);
        if (err.name === "AbortError") {
            return res.status(504).json({ status: "failed", message: "Target timed out" });
        }
        return res.status(500).json({ status: "failed", message: "Proxy connection error" });
    }
});



router.get("/ip", (req, res) => {
    const { format } = req.query;
    const ip = req.ip;
    const defaultFormats = ['json', 'html', 'xml', 'csv', 'yaml'];

    if (!format) {
        return res.send(ip);
    }

    if (defaultFormats.includes(format)) {
        if (format === 'json') {
            return res.json({
                status: 'success',
                ip: ip
            })
        } else if (format === 'html') {
            const html = `<p>${ip}</p>`;
            res.set('Content-Type', "text/html; charset=UTF-8");
            return res.send(html);
        } else if (format === 'xml') {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                            <client>
                            <ip>${ip}</ip>
                            </client>`;
            res.set('Content-Type', "application/xml; charset=UTF-8");
            return res.send(xml);
        } else if (format === 'csv') {
            const csv = `${ip}\n`;
            res.set('Content-Type', "text/csv; charset=UTF-8");
            return res.send(csv);
        } else if (format === 'yaml') {
            const yaml = `ip: ${ip}\n`;
            res.set('Content-Type', "text/yaml; charset=UTF-8");
            return res.send(yaml);
        }
    } else {
        return res.status(400).json({
            status: 'failed',
            message: `Invalid or unrecognized format provided: '${format}'! Please provide a valid format!`
        })
    }
})

router.get("/ip/formats", (req, res) => {
    const defaultFormats = [
        { name: '<a href="https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/JSON">json</a>', description: 'JavaScript Object Notation, a lightweight data interchange format.' },
        { name: '<a href="https://developer.mozilla.org/en-US/docs/Web/HTML">html</a>', description: 'HyperText Markup Language, a standard markup language used to create web pages.' },
        { name: '<a href="https://developer.mozilla.org/en-US/docs/Web/XML/XML_introduction">xml</a>', description: 'Extensible Markup Language, a markup language that defines a set of rules for encoding documents in a format that is both human-readable and machine-readable.' },
        { name: '<a href="https://en.wikipedia.org/wiki/Comma-separated_values#:~:text=CSV%20is%20a%20delimited%20data,all%20line%2Dend%20variations).">csv</a>', description: 'Comma Separated Values, a plain text file format that stores tabular data, such as numbers and text, separated by commas.' },
        { name: '<a href="https://en.wikipedia.org/wiki/YAML">yaml</a>', description: 'YAML Ain\'t Markup Language, a human-readable serialization format commonly used for configuration files and data exchange.' }
    ];

    ejs.renderFile(path.join(__dirname, "..", "..", "./views/formats.ejs"), { defaultFormats }, (err, html) => {
        if (err) {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        } else {
            res.set("Content-Type", "text/html");
            res.send(html);
        }
    });
});


router.get("/users", (req, res) => {
    const usersData = fs.readFileSync(path.join(__dirname, "..", "..", "/data/data.json"), "utf-8");
    const { id } = req.query;
    if (id) {
        const users = JSON.parse(usersData);
        const num = Number(id);
        const user = users.find((user) => user.id === num);
        if (!user) {
            console.log(`No user found with the given id: ${id}`);
            return res.status(404).json({
                status: 'failed',
                message: `User not found with the given id: ${id}`
            });
        }
        console.log(`User found with the given id: ${id}`);
        return res.json(user);
    }
    const filePath = path.join(__dirname, "..", "..", "./data/data.json");
    const readStream = fs.createReadStream(filePath, "utf-8");
    req.on("close", () => {
        return readStream.destroy();
    })
    res.set('Content-Type', "application/json");
    readStream.on("ready", () => {
        console.log(`Rest api request from: ${req.ip}`);
        return console.log(`Stream is starting...`);
    })
    readStream.on("error", (err) => {
        res.status(500).json({
            status: 'failed',
            message: "Oops! It's seems like we are experiencing an ongoing issue with our backend servers while fetching the data! Please try again after sometime"
        });
        return console.log(err);
    })
    readStream.pipe(res);
    readStream.on("end", () => {
        console.log(`Data has been successfully sent to the client!`);
        return res.end();
    })
})

router.get("/users/:id", (req, res) => {
    const id = Number(req.params.id);
    const usersData = fs.readFileSync(path.join(__dirname, "..", "..", "/data/data.json"), "utf-8");
    if (id) {
        const users = JSON.parse(usersData);
        const num = Number(id);
        const user = users.find((user) => user.id === num);
        if (!user) {
            console.log(`No user found with the given id: ${id}`);
            return res.status(404).json({
                status: 'failed',
                message: `User not found with the given id: ${id}`
            });
        }
        console.log(`User found with the given id: ${id}`);
        return res.json(user);
    } else {
        return res.status(400).json({
            status: 'failed',
            message: `Invalid user id provided: ${req.params.id}`
        })
    }
})

router.post("/users", (req, res) => {
    try {
        const body = req.body;
        if (Object.keys(body).length === 0 || !body) {
            console.log(`${req.ip} didn't provided any data for ${req.method} to this /users route!`);
            return res.status(400).json({
                status: 'failed',
                message: `Bad request! Expected data to be present in the body but got 'null'!`,
            });
        }
        const filePath = path.join(__dirname, "..", "..", "./data/data.json");
        const usersData = fs.readFileSync(filePath, "utf-8");
        const users = JSON.parse(usersData);
        users.push({ ...body, id: users.length + 1 });

        const usersWriteStream = fs.createWriteStream(filePath, "utf-8");
        usersWriteStream.write(JSON.stringify(users));
        usersWriteStream.end();

        usersWriteStream.on("ready", () => {
            return console.log(`Write stream is ready to write the data!`);
        })
        usersWriteStream.on("finish", () => {
            console.log(`Created a new user with id: ${users.length}!`);
            return res.json({
                status: 'success',
                message: `Sucessfully created a new user with id: ${users.length}`
            })
        })
        usersWriteStream.on("error", (err) => {
            console.error(err);
            return res.status(500).json({
                status: 'failed',
                message: `Oops! It seems like we are experiencing an issue while processing your request! Please try again after some time!`
            })
        });
        req.on("close", () => {
            return usersWriteStream.destroy();
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 'failed',
            message: `Oops! There was an error while processing your request! Please try again later!`,
        })
    }
})

router.delete("/users/:id", (req, res) => {
    const filePath = path.join(__dirname, "..", "..", "./data/data.json");
    const id = Number(req.params.id) || Number(req.query.id);
    if (!id) {
        console.log(`No id provided by ${req.ip} for the ${req.method} request!`);
        return res.status(400).json({
            status: 'failed',
            message: `No id provided for the ${req.method} request!`
        })
    }
    let data = "";
    const usersReadStream = fs.createReadStream(filePath, "utf-8");
    req.on("close", () => {
        usersReadStream.destroy();
    })
    usersReadStream.on("ready", () => {
        return console.log(`Users read stream is now ready to be streamed!`);
    });
    usersReadStream.on("data", (chunk) => {
        data += chunk;
    });
    usersReadStream.on("end", () => {
        if (data) {
            const myData = JSON.parse(data);
            const index = myData.findIndex(user => user.id === id);
            myData.splice(index, 1);

            if (index !== -1) {
                const stream = fs.createWriteStream(filePath, "utf-8");
                stream.write(JSON.stringify(myData));
                stream.end();
                stream.on("finish", () => {
                    console.log(`User deleted successfully with the given id: ${id}!`);
                    return res.json({
                        status: 'success',
                        message: `User deleted sucessfully with id: ${id}!`
                    });
                })
                stream.on("error", (err) => {
                    console.error(err);
                    return res.status(500).json({
                        status: 'failed',
                        message: `Oops! It seems like we are experiencing an issue while processing your request! Please try again later!`,
                    })
                })
            } else {
                console.log(`Cannot find a valid user with the given id: ${id}!`);
                return res.status(404).json({
                    status: 'failed',
                    message: `User not found with the given id: ${id}!`
                })
            }
        }
    });
    usersReadStream.on("error", (err) => {
        console.error(err);
        return res.status(500).json({
            status: 'failed',
            message: `Oops! It seems like we are experiencing an issue while processing your request! Please try again after some time!`,
        })
    });
})

router.use((req, res, next) => {
    console.log(`${req.ip} ${req.method} on ${req.path} wasn't found in this server!`);
    return res.status(404).json({
        status: 'failed',
        message: `The requested URL '${req.path}' with '${req.method}' HTTP request was not found in the server!`,
    });
})

/*
router.all("/{*path}", (req, res, next) => {
    return res.status(404).json({
        status: 'failed',
        message: `The requested URL '${req.path}' with '${req.method}' HTTP request was not found in the server!`,
    });
})*/

export default router;
