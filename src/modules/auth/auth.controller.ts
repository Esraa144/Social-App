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
  authService.signupWithGmail
);
router.post(
  "/login-gmail",
  validation(validators.signupWithGmail),
  authService.loginWithGmail
);

router.post("/login", validation(validators.login), authService.login);

router.patch(
  "/send-forgot-password",
  validation(validators.sendForgotPasswordCode),
  authService.sendForgotPasswordCode
);

router.patch(
  "/verify-forgot-password",
  validation(validators.verifyForgotPassword),
  authService.sendForgotPasswordCode
);

router.patch(
  "/reset-forgot-password",
  validation(validators.resetForgotPassword),
  authService.resetForgotPassword
);

router.patch(
  "/update-password",
  validation(validators.updatePassword),
  authService.updatePassword
);

router.patch(
  "/update-info",
  validation(validators.updateInfo),
  authService.updateInfo
);

router.patch(
  "/two-step",
  validation(validators.enableTwoStepSchema),
  authService.enableTwoStep
);

export default router;
