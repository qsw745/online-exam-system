import { Router } from 'express'
import type { Response } from 'express'
import { CryptoService } from '../services/crypto.service'

const router = Router()

router.get('/pubkey', (_req, res: Response) => {
    const { alg, pem } = CryptoService.getPublicKey()
    res.json({ success: true, data: { alg, pem } })
})

export { router as cryptoRoutes }
