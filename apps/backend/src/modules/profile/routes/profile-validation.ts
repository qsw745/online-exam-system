import { body } from 'express-validator'

export const updateProfileValidation = [
    body('email').optional().isEmail().isLength({ max: 120 }),
    body('nickname').optional().isString().isLength({ min: 1, max: 50 }),
    body('phone').optional().isString().isLength({ max: 30 }).custom(value => value.length === 0 || value.length >= 3),
    body('bio').optional().isString().isLength({ max: 500 }),
    body('avatar').optional().isString().isLength({ max: 500 }),
    body('school').optional().isString().isLength({ max: 100 }),
    body('class_name').optional().isString().isLength({ max: 100 }),
  ]
