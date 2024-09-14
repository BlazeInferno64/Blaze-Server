import express from "express";
const router = express.Router();
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import helmet from "helmet";

router.use(helmet());
router.use(express.urlencoded({ extended: false }));
router.use(express.urlencoded({ extended: false }));
router.use(express.json());
router.use(express.raw());
router.use(express.query());
router.use(express.text());
router.use(cookieParser());

/**
 * Make a post route '/oauth' where the main logic behind user authentication is present
 */

router.post("/", (req, res) => {
    const { username, password } = req.body;
    if (!username) return res.status(400).json({ status: 'failed', message: 'Username provided is most likely invalid or empty!' });
    if (!password) return res.status(400).json({ status: 'failed', message: 'Password provided is most likely invalid or empty!' });
  
    if (req.cookies.adminLoggedIn) {
      res.redirect("/dashboard"); // redirect to another route if the cookie exists
    }
  
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      res.set('Content-Type', "application/json");
      res.cookie('adminLoggedIn', true, { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
    }); 
    // set a cookie that expires in 24 minutes
      const msg = {
        status: 'success',
        message: `Hello there ${username} welcome to the admin portal of Blaze Server!\nYou can now access the dashboard by visiting '/dashboard' route!\nPlease note that after 24Hrs of logging in, you will be prompted for login again!`
      }
      return res.json(msg); // Send JSON response
    } else {
      return res.status(401).json({
        status: 'failed',
        message: 'Invalid password or username!'
      });
    }
})

export default router;