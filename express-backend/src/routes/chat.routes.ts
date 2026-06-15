import { Router } from 'express';
import { chat } from '../controllers/chat.controller';

const router = Router();

// Widget endpoint - authenticated via API Key in body
router.post('/', chat);

export default router;
