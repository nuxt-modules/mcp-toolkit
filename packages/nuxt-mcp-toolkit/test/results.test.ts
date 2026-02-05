import { describe, it, expect } from 'vitest'
import { textResult, jsonResult, errorResult, imageResult } from 'nitro-mcp-toolkit/definitions'

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
})
