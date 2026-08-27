/**
 * Configure Monaco Editor to use locally bundled workers instead of CDN.
 * Must be imported once (in main.tsx) before any <Editor> component renders.
 *
 * The package exports "./*" → "./esm/vs/*.js", so we omit the "esm/vs/" prefix:
 *   monaco-editor/editor/editor.worker  → esm/vs/editor/editor.worker.js  ✓
 *   monaco-editor/language/json/…       → esm/vs/language/json/…          ✓
 *
 * The ?worker suffix tells Vite to bundle each file as a separate Web Worker.
 */
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_: string, label: string): Worker {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })
