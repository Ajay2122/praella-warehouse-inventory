import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../lib/asyncHandler';
import { loginSchema, refreshSchema, signupSchema } from './auth.schemas';
import * as ctrl from './auth.controller';

export const authRouter = Router();

authRouter.post('/signup', validate({ body: signupSchema }), asyncHandler(ctrl.signupHandler));
authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(ctrl.loginHandler));
authRouter.post('/refresh', validate({ body: refreshSchema }), asyncHandler(ctrl.refreshHandler));
authRouter.post('/logout', validate({ body: refreshSchema }), asyncHandler(ctrl.logoutHandler));
authRouter.get('/me', requireAuth, asyncHandler(ctrl.meHandler));
