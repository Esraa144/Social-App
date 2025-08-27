import * as validators from "./auth.validation";
import { validation } from "../../middleware/validation.middeware";
import authService from "./auth.service";
import { Router } from "express";
const router: Router = Router();

router.post("/signup", validation(validators.signup), authService.signup);
router.patch(
  "/confirm-email",
  validation(validators.confirmEmail),
  authService.confirmEmail
);
router.post("/login", validation(validators.login), authService.login);
export default router;
