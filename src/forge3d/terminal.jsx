import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import './terminal.css'

export default function TerminalPane({ colors }) {
  const containerRef = useRef(null)
  const terminalRef = useRef(null)
  const fitAddonRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Check if running in Electron
    const isElectron = window.forgeAPI?.spawnTerminal

    if (!isElectron) {
      // Show fallback message in browser mode
      containerRef.current.innerHTML = `
        <div style="padding: 20px; color: ${colors.textSecondary}; text-align: center;">
          <p>Terminal is only available in Electron desktop mode.</p>
          <p style="margin-top: 10px; font-size: 0.9em;">Run <code>npm run electron:dev</code> to use the terminal.</p>
        </div>
      `
      return
    }

    // Initialize xterm.js
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: colors.panelBg,
        foreground: colors.text,
        cursor: colors.primary,
        selection: colors.selectionBg,
        black: '#000000',
        red: '#e06c75',
        green: '#98c379',
        yellow: '#d19a66',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
        brightBlack: '#5c6370',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#d19a66',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Spawn PTY in main process
    window.forgeAPI.spawnTerminal().then((result) => {
      if (result.error) {
        terminal.writeln(`\x1b[31mError: ${result.error}\x1b[0m`)
        terminal.writeln('Terminal could not be initialized.')
      }
    })

    // Pipe terminal input to PTY
    terminal.onData((data) => {
      window.forgeAPI.writeTerminal(data)
    })

    // Pipe PTY output to terminal
    const unsubscribe = window.forgeAPI.onTerminalData((data) => {
      terminal.write(data)
    })

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
      window.forgeAPI.resizeTerminal(terminal.cols, terminal.rows)
    }

    window.addEventListener('resize', handleResize)
    // Also trigger fit after a short delay to ensure layout is stable
    const timeoutId = setTimeout(handleResize, 100)

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
      unsubscribe()
      window.forgeAPI.killTerminal()
      terminal.dispose()
    }
  }, [colors])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: colors.panelBg,
      }}
    />
  )
}
