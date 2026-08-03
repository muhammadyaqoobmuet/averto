
import z from "zod"
import type { loginSchema, signupSchema } from "../utils/schemas"



export type loginSchema = z.infer<typeof loginSchema>
export type signupSchema = z.infer<typeof signupSchema>