import dotenv from "dotenv";
dotenv.config();
import express from "express";
import helmet from "helmet";
import fs from "fs";
import cluster from "cluster";
import os, { availableParallelism } from "os";
import JSONStream from "JSONStream";
import path from "path";
import ejs from "ejs";
import cookieParser from "cookie-parser";

import apiRoute from "./api/api.js";
import adminRoute from "./admin/admin.js";
import oauthRoute from "./oauth/oauth.js";
import dashboardRoute from "./dashboard/dashboard.js";

import { lastUpdatedDate } from "./tools/lastupdate.js";
import { serverStatus } from "./tools/serverstatus.js";


const __dirname = import.meta.dirname;
const PORT = process.env.PORT || 3000;
const numCpus = availableParallelism(); //os.cpus().length; is generally not recommended for this case!



// Create a function to handle worker process
function startWorker() {
    serverStatus.Server = "online";
    const app = express();

    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    app.use(express.raw());
    app.use(express.query());
    app.use(express.text());
    app.use(cookieParser());
    app.enable("trust proxy");
    // Set the view engine to EJS
    app.set('view engine', 'ejs');
    app.use(helmet());
    app.use(express.static(path.join(__dirname, "..", "./views")));
    app.use((req, res, next) => {
        const logTemplate = `'${req.method}' '${req.originalUrl}' ${req.ip} ${req.headers['user-agent']} ${Date()}\n\n`;
        const logStream = fs.createWriteStream(path.join(__dirname, "../logs/log.txt"), { flags: 'a' });

        logStream.write(logTemplate, (err) => {
            if (err) {
                console.error(`Error logging request: ${err}`);
            }
        });

        logStream.on('error', (err) => {
            console.error(`Error writing to log file: ${err}`);
        });

        next();
    });
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                imgSrc: ["'self'", "data:", "https://avatars.githubusercontent.com"]
            },
        },
    }));
    app.use("/api", apiRoute);
    app.use("/admin", adminRoute);
    app.use("/oauth", oauthRoute);
    app.use("/dashboard", dashboardRoute);
    app.use("/github", (req, res, next) => {
        res.redirect("https://github.com/blazeinferno64");
        next();
    })

    app.get("/", (req, res) => {
        const formattedDate = lastUpdatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const data = { formattedDate, serverStatus };
        ejs.renderFile(path.join(__dirname, "..", "./views/index.ejs"), data, (err, html) => {
            if (err) {
                console.error(err);
                res.status(500).json({ message: "Internal Server Error" });
            } else {
                res.set("Content-Type", "text/html");
                return res.send(html);
            }
        });
    });

    app.get("/status", (req, res) => {
        return res.json({
            status: "sucess",
            message: `All servers are ${serverStatus.Server}`
        })
    })

    // Use async/await to read file
    app.get("/users", async (req, res) => {
        try {
            const filePath = "./data/data.json";
            const readStream = fs.createReadStream(filePath, "utf-8");
            res.set("Content-Type", "text/html");

            const jsonStream = JSONStream.parse("*");
            readStream.pipe(jsonStream);

            let usersHtml = "<ul>";

            jsonStream.on("data", (user) => {
                usersHtml += `<li>${user.first_name}</li>`;
            });

            jsonStream.on("end", () => {
                usersHtml += "</ul>";
                res.send(usersHtml);
            });

            jsonStream.on("error", (err) => {
                console.error(err);
                res.status(500).json({ message: "Internal Server Error" });
            });

            req.on("close", () => {
                readStream.destroy();
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    });

    app.all("*", (req, res, next) => {
        res.status(404);
        const data = { url: req.path, method: req.method };
        ejs.renderFile(path.join(__dirname, "..", "./views/404.ejs"), data, (err, html) => {
            if (err) {
                console.error(err);
                res.status(500).json({ message: "Internal Server Error" });
            } else {
                res.set("Content-Type", "text/html");
                res.send(html);
            }
        });
    });

    app.listen(PORT, () => {
        return console.log(`Blaze server is listening on port: ${PORT}`);
    });
    console.log(`Worker ${process.pid} started`);
}

// Check if its the primary clutser
// Else start the worker
if (cluster.isPrimary) {
    console.log(`Cpu cores present: ${numCpus} in the host machine`);
    console.log(`Primary process is running with process id: ${process.pid}`);
    for (let i = 0; i < numCpus; i++) {
        cluster.fork();
    }
    cluster.on("exit", (worker, code, signal) => {
        return console.log(`Worker ${worker.process.pid} died!`);
    });
} else {
    startWorker();
}