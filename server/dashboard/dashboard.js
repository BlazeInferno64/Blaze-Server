import express from "express";
const router = express.Router();
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import ejs from "ejs";

import { calculateMemoryUsage } from "../tools/memory.js";
import { lastUpdatedDate } from "../tools/lastupdate.js";
import { serverStatus } from "../tools/serverstatus.js";
import { getCpuInfo } from "../tools/cpu.js";
import { getHostInfo } from "../tools/host.js";

serverStatus.Server = "online";
let status = serverStatus.Server;

const __dirname = import.meta.dirname;

const filePath = path.join(__dirname, "..", "..", "./logs/log.txt");

router.use(helmet());
router.use(helmet({
    contentSecurityPolicy: {
        directives: {
            imgSrc: ["'self'", "data:", "https://avatars.githubusercontent.com"]
        },
    },
}));
router.use(express.urlencoded({ extended: false }));
router.use(express.urlencoded({ extended: false }));
router.use(express.json());
router.use(express.raw());
router.use(express.query());
router.use(express.text());
router.use(cookieParser());

/**
 * Make a GET route at '/dashboard' where the main logic behind the dashboard is present
 */

router.get("/", (req, res) => {
    const formattedDate = lastUpdatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (req.cookies.adminLoggedIn) {
        const logsReadStream = fs.createReadStream(filePath, "utf-8");
        logsReadStream.on("ready", () => {
            return console.log(`Read stream is ready to read logs!`);
        })
        logsReadStream.on("error", (err) => {
            console.error(err);
            return res.status(500).json({
                status: 'failed',
                message: 'Oops! an error occured while trying to read the logs!'
            })
        })
        let logs = ''; // Initialize logs as an empty string

        logsReadStream.on("data", (chunk) => {
            logs += chunk; // Now you can concatenate the chunk to logs
        })
        logsReadStream.on("end", () => {
            console.log(`Finished reading logs!`);
            const memoryUsage = calculateMemoryUsage().memoryUsage;
            const totalMemory = calculateMemoryUsage().totalMemory;
            const freeMemory = calculateMemoryUsage().freeMemory;

            const cpuName = getCpuInfo().cpuModel;
            const cpuSpeed = getCpuInfo().cpuSpeed;
            const cpuCores = getCpuInfo().cpuCores;
            const cpuParallelism = getCpuInfo().cpuParallelism;

            const hostname = getHostInfo().hostname;
            const hostOS = getHostInfo().hostOS;
            const uptime = getHostInfo().osUptime;
            const osRelease = getHostInfo().osRelease;
            const osType = getHostInfo().osType;
            const arch = getHostInfo().arch;
            const hostMachine = getHostInfo().hostMachine;

            let progressBarColor;
            let memInfo;
            if (memoryUsage < 50) {
                progressBarColor = 'bg-success';
                memInfo = "Low"
            } else if (memoryUsage < 75) {
                progressBarColor = 'bg-warning';
                memInfo = "Moderate"
            } else {
                progressBarColor = 'bg-danger';
                memInfo = "High"
            }
            const data = { memoryUsage, logs, formattedDate, status, progressBarColor, totalMemory, freeMemory, memInfo, cpuName, cpuCores, cpuSpeed, cpuParallelism, hostname, hostOS, uptime, osRelease, arch, osType, hostMachine };
            ejs.renderFile(path.join(__dirname, "..", "..", "./views/dashboard.ejs"), data, (err, html) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ message: "Internal Server Error" });
                } else {
                    res.set("Content-Type", "text/html");
                    return res.send(html);
                }
            });
        })
    } else {
        return res.redirect("/admin");
    }
})

/**
 * Making an /logs/:action GET route where various user interaction for logs are present such as 'CLEAR', 'DOWNLOAD', 'GET'
 */

router.get("/logs/:action", (req, res) => {
    if (req.cookies.adminLoggedIn) {
        const { action } = req.params;

        if (action === 'clear') {
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(404).json({
                        status: 'failed',
                        message: 'Oops! The log file does not exist!'
                    })
                }
                fs.truncate(filePath, 0, (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            status: 'failed',
                            message: 'Oops! An error occured!'
                        })
                    }
                    res.json({
                        status: 'success',
                        message: `Logs cleared successfully!`
                    });
                    return console.log(`Logs have been successfully cleared!`);
                })
            })
        } else if (action === 'download') {
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    console.error(err);
                    return res.status(404).json({
                        status: 'failed',
                        message: 'Oops! The log file does not exist!'
                    })
                }
                res.set("Content-Disposition", `attachment; filename="logs.txt"`);
                res.set("Content-Type", "text/plain");
                const logsReadStream = fs.createReadStream(filePath, "utf-8");
                logsReadStream.on("ready", () => {
                    return console.log(`Logs read stream is now ready!`);
                })
                logsReadStream.pipe(res);
                logsReadStream.on("error", (err) => {
                    console.error(err);
                    return res.status(500).json({
                        status: 'failed',
                        message: 'Oops! An error occured while downloading logs!'
                    })
                })
            })
        } else if (action === "get") {
            res.set("Content-Type", "text/plain");
            const logsReadStream = fs.createReadStream(filePath, "utf-8");
            logsReadStream.on("ready", () => {
                return console.log(`Logs read stream is now ready for sending!`);
            })
            logsReadStream.pipe(res);
            logsReadStream.on("error", (err) => {
                console.error(err);
                return res.status(500).json({
                    status: 'failed',
                    message: 'Oops! An error occured while downloading logs!'
                })
            })
        } else {
            return res.status(404).json({
                status: 'failed',
                message: `Invalid action or unrecognized action: ${action}!`
            })
        }
    } else {
        return res.redirect("/admin");
    }
})


export default router;