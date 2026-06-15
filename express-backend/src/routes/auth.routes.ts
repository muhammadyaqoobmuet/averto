import { Router } from "express";
import {
  signup,
  login,
  me,
  logout,
  refresh,
  updateProfile,
  changePassword,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authenticate, me);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.patch("/profile", authenticate, updateProfile);
router.patch("/password", authenticate, changePassword);

export default router;
