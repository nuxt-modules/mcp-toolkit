import { describe, it, expect } from 'vitest'
import { textResult, jsonResult, errorResult, imageResult, audioResult, normalizeToolResult } from '../src/runtime/server/mcp/definitions/results'

describe('Result Helpers', () => {
  describe('textResult', () => {
    it('should create a text result', () => {
      const result = textResult('Hello world')

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello world' }],
      })
    })

    it('should handle empty string', () => {
      const result = textResult('')

      expect(result).toEqual({
        content: [{ type: 'text', text: '' }],
      })
    })

    it('should handle special characters', () => {
      const result = textResult('Hello\nWorld\t!')

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello\nWorld\t!' }],
      })
    })
  })

  describe('jsonResult', () => {
    it('should create a JSON result with pretty printing by default', () => {
      const data = { foo: 'bar', count: 42 }
      const result = jsonResult(data)

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      })
    })

    it('should create a compact JSON result when pretty is false', () => {
      const data = { foo: 'bar', count: 42 }
      const result = jsonResult(data, false)

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(data) }],
      })
    })

    it('should handle arrays', () => {
      const data = [1, 2, 3]
      const result = jsonResult(data)

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      })
    })

    it('should handle nested objects', () => {
      const data = { user: { name: 'John', settings: { theme: 'dark' } } }
      const result = jsonResult(data)

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      })
    })

    it('should handle null', () => {
      const result = jsonResult(null)

      expect(result).toEqual({
        content: [{ type: 'text', text: 'null' }],
      })
    })
  })

  describe('errorResult', () => {
    it('should create an error result', () => {
      const result = errorResult('Something went wrong')

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Something went wrong' }],
        isError: true,
      })
    })

    it('should set isError to true', () => {
      const result = errorResult('Error message')

      expect(result.isError).toBe(true)
    })
  })

  describe('imageResult', () => {
    it('should create an image result', () => {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const result = imageResult(base64Data, 'image/png')

      expect(result).toEqual({
        content: [{ type: 'image', data: base64Data, mimeType: 'image/png' }],
      })
    })

    it('should handle different mime types', () => {
      const base64Data = '/9j/4AAQSkZJRg=='
      const result = imageResult(base64Data, 'image/jpeg')

      expect(result).toEqual({
        content: [{ type: 'image', data: base64Data, mimeType: 'image/jpeg' }],
      })
    })

    it('should handle webp mime type', () => {
      const base64Data = 'UklGRh4AAABXRUJQVlA4'
      const result = imageResult(base64Data, 'image/webp')

      expect(result).toEqual({
        content: [{ type: 'image', data: base64Data, mimeType: 'image/webp' }],
      })
    })
  })

  describe('audioResult', () => {
    it('should create an audio result', () => {
      const base64Data = '//uQx'
      const result = audioResult(base64Data, 'audio/mp3')

      expect(result).toEqual({
        content: [{ type: 'audio', data: base64Data, mimeType: 'audio/mp3' }],
      })
    })

    it('should handle wav mime type', () => {
      const base64Data = 'UklGRiQAAABXQVZFZm10'
      const result = audioResult(base64Data, 'audio/wav')

      expect(result).toEqual({
        content: [{ type: 'audio', data: base64Data, mimeType: 'audio/wav' }],
      })
    })

    it('should handle ogg mime type', () => {
      const base64Data = 'T2dnUwAC'
      const result = audioResult(base64Data, 'audio/ogg')

      expect(result).toEqual({
        content: [{ type: 'audio', data: base64Data, mimeType: 'audio/ogg' }],
      })
    })
  })

  describe('normalizeToolResult', () => {
    it('should wrap a string into a text CallToolResult', () => {
      const result = normalizeToolResult('Hello world')

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello world' }],
      })
    })

    it('should wrap a number into a text CallToolResult', () => {
      const result = normalizeToolResult(42)

      expect(result).toEqual({
        content: [{ type: 'text', text: '42' }],
      })
    })

    it('should handle zero', () => {
      const result = normalizeToolResult(0)

      expect(result).toEqual({
        content: [{ type: 'text', text: '0' }],
      })
    })

    it('should handle negative numbers', () => {
      const result = normalizeToolResult(-3.14)

      expect(result).toEqual({
        content: [{ type: 'text', text: '-3.14' }],
      })
    })

    it('should handle empty string', () => {
      const result = normalizeToolResult('')

      expect(result).toEqual({
        content: [{ type: 'text', text: '' }],
      })
    })

    it('should pass through a CallToolResult unchanged', () => {
      const input = { content: [{ type: 'text' as const, text: 'already wrapped' }] }
      const result = normalizeToolResult(input)

      expect(result).toBe(input)
    })

    it('should pass through a CallToolResult with isError and content unchanged', () => {
      const input = { content: [{ type: 'text' as const, text: 'error' }], isError: true }
      const result = normalizeToolResult(input)

      expect(result).toBe(input)
    })

    it('should pass through a CallToolResult with structuredContent and content unchanged', () => {
      const input = {
        content: [{ type: 'text' as const, text: 'fallback' }],
        structuredContent: { foo: 'bar' },
      }
      const result = normalizeToolResult(input as Record<string, unknown>)

      expect(result).toBe(input)
    })

    it('should wrap a boolean true as text', () => {
      const result = normalizeToolResult(true)

      expect(result).toEqual({
        content: [{ type: 'text', text: 'true' }],
      })
    })

    it('should wrap a boolean false as text', () => {
      const result = normalizeToolResult(false)

      expect(result).toEqual({
        content: [{ type: 'text', text: 'false' }],
      })
    })

    it('should wrap a plain object as JSON text', () => {
      const result = normalizeToolResult({ id: 1, name: 'Nuxt' })

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ id: 1, name: 'Nuxt' }, null, 2) }],
      })
    })

    it('should wrap an array as JSON text', () => {
      const result = normalizeToolResult([1, 2, 3])

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify([1, 2, 3], null, 2) }],
      })
    })

    it('should wrap nested objects as JSON text', () => {
      const data = { user: { name: 'John', settings: { theme: 'dark' } } }
      const result = normalizeToolResult(data)

      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      })
    })

    it('should auto-generate fallback for isError without content', () => {
      const result = normalizeToolResult({ isError: true } as Record<string, unknown>)

      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Tool execution failed' }],
      })
    })

    it('should auto-generate fallback for isError with structuredContent but no content', () => {
      const input = { isError: true, structuredContent: { code: 'NOT_FOUND' } }
      const result = normalizeToolResult(input as Record<string, unknown>)

      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ code: 'NOT_FOUND' }) }])
    })

    it('should auto-generate text fallback for structuredContent without content', () => {
      const input = { structuredContent: { name: 'Nuxt', version: 4 } }
      const result = normalizeToolResult(input as Record<string, unknown>)

      expect(result.structuredContent).toEqual({ name: 'Nuxt', version: 4 })
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ name: 'Nuxt', version: 4 }) }])
    })
  })
})
