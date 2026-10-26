import { execSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectIDE } from '../src/utils/ide'

vi.mock('node:child_process', () => ({ execSync: vi.fn() }))

describe('detectIDE', () => {
  beforeEach(() => {
    for (const key of ['__CFBundleIdentifier', 'CURSOR_TRACE_ID', 'VSCODE_IPC_HOOK']) vi.stubEnv(key, undefined)
    vi.mocked(execSync).mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // only the single full-table query gets an answer
  const mockProcessTable = (rows: Array<[pid: number, ppid: number, name: string]>) => {
    vi.mocked(execSync).mockImplementation((command) => {
      if (command !== 'ps -A -o pid=,ppid=,comm=') throw new Error(`unexpected command: ${command}`)
      return Buffer.from(rows.map(([pid, ppid, name]) => `${String(pid).padStart(7)} ${String(ppid).padStart(7)} ${name}`).join('\n') + '\n')
    })
  }

  it('finds Cursor among the ancestors with a single ps call', () => {
    mockProcessTable([
      [process.ppid, 200, 'node'],
      [200, 100, 'zsh'],
      [100, 1, '/Applications/Cursor.app/Contents/MacOS/Cursor'],
    ])
    expect(detectIDE()).toBe('cursor')
    expect(execSync).toHaveBeenCalledTimes(1)
  })

  it('finds VS Code from a helper process name with spaces', () => {
    mockProcessTable([
      [process.ppid, 300, 'bash'],
      [300, 1, '/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)'],
    ])
    expect(detectIDE()).toBe('vscode')
  })

  it('returns null when no ancestor is an IDE', () => {
    mockProcessTable([
      [process.ppid, 400, 'node'],
      [400, 1, 'bash'],
    ])
    expect(detectIDE()).toBeNull()
  })

  it('returns null when ps is not available', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('ps: not found')
    })
    expect(detectIDE()).toBeNull()
  })

  it('does not run ps when the environment names the IDE', () => {
    vi.stubEnv('CURSOR_TRACE_ID', 'x')
    expect(detectIDE()).toBe('cursor')
    expect(execSync).not.toHaveBeenCalled()
  })
})
