import { defineHandler } from 'h3'
import mcp from '#mcp/mcp/handler'

// What `/mcp` serves, from the same set the endpoint registered.
export default defineHandler(() => mcp.definitions)
