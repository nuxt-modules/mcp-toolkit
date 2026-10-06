import { defineHandler } from 'h3'
import { toolCalls } from '../utils/tool-calls.ts'

export default defineHandler(() => toolCalls)
