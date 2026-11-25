import { defineEventHandler } from 'nuxt/server'
import { signals } from '../utils/signals'

export default defineEventHandler(() => signals)
