import { defineEventHandler } from 'h3'
import { toolCalls } from '../utils/tool-calls'

export default defineEventHandler(() => toolCalls)
