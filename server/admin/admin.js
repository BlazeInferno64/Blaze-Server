import express from "express";
const router = express.Router();
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import ejs from "ejs";
import path from "path";

import { lastUpdatedDate } from "../tools/lastupdate.js";
import { serverStatus } from "../tools/serverstatus.js";

const __dirname = import.meta.dirname;

serverStatus.Server = "online";

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
 * Making a GET route for '/dashboard' '/admin' route where admin interaction is handled
 */

router.get("/", (req, res) => {
    if (req.cookies.adminLoggedIn) {
        res.redirect("/dashboard"); // redirect to another route if the cookie exists
    } else {
        const formattedDate = lastUpdatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const data = { formattedDate, serverStatus };
        ejs.renderFile(path.join(__dirname, "..", ".." , "./views/login.ejs"), data, (err, html) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Internal Server Error" });
            } else {
                res.set("Content-Type", "text/html");
                return res.send(html);
            }
        });
    }
})

export default router;