import * as validators from "./auth.validation";
import { validation } from "../../middleware/validation.middleware";
import authService from "./auth.service";
import { Router } from "express";
const router: Router = Router();

router.post("/signup", validation(validators.signup), authService.signup);
router.patch(
  "/confirm-email",
  validation(validators.confirmEmail),
  authService.confirmEmail
);

router.post(
  "/signup-gmail",
  validation(validators.signupWithGmail),
  authService.signupWtihGmail
);
router.post(
  "/login-gmail",
  validation(validators.signupWithGmail),
  authService.loginWtihGmail
);

router.post("/login", validation(validators.login), authService.login);
export default router;
