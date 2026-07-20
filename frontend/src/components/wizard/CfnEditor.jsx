import { useEffect, useRef } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
// Importing monaco-editor/monaco-yaml's worker entry points directly from their
// package path with Vite's ?worker suffix breaks the worker's foreign-module RPC
// registration (findDocumentSymbols/getFoldingRanges come back "Missing
// requestHandler or method") — a documented Vite pitfall for both packages. The
// fix is the indirection below: import each from a local wrapper file instead of
// the package path directly.
import EditorWorker from '../../monaco/editor.worker.js?worker'
import YamlWorker from '../../monaco/yaml.worker.js?worker'

// Wire the Monaco web workers for Vite. monaco-yaml runs the schema/diagnostics
// language service in the 'yaml' worker; everything else uses the base editor
// worker. This must be set before any editor mounts.
if (!window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      switch (label) {
        case 'editorWorkerService':
          return new EditorWorker()
        case 'yaml':
          return new YamlWorker()
        default:
          throw new Error(`Unknown Monaco worker label: ${label}`)
      }
    },
  }
}

// Use the locally-bundled monaco instead of the default CDN download.
loader.config({ monaco })

// Browser-side "LSP": completion + hover against the CloudFormation JSON schema.
// Schema *validation* is deliberately OFF — the goformation schema can't model CFN
// intrinsics (!Ref / !Sub / !GetAtt / {{resolve:...}}), so it flags a real template
// with perpetual false-positive errors. The backend cfn-lint markers (the Validate
// button) are the authoritative diagnostics.
const CFN_SCHEMA_URI =
  'https://raw.githubusercontent.com/awslabs/goformation/master/schema/cloudformation.schema.json'

let yamlConfigured = false
function ensureYamlConfigured() {
  if (yamlConfigured) return
  yamlConfigured = true
  configureMonacoYaml(monaco, {
    enableSchemaRequest: true,
    hover: true,
    completion: true,
    validate: false,  // see note above — cfn-lint (backend) owns diagnostics
    format: true,
    schemas: [{ uri: CFN_SCHEMA_URI, fileMatch: ['*'] }],
  })
}

const SEVERITY = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
}

/**
 * Monaco YAML editor for the generated CloudFormation template.
 *
 * Props:
 *   value     — current template text (controlled)
 *   onChange  — (text) => void, fired on user edits
 *   markers   — cfn-lint diagnostics [{level, line, column, end_line, end_column, message, rule}]
 *   readOnly  — disable editing (while generating / refining)
 */
export default function CfnEditor({ value, onChange, markers = [], readOnly = false }) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

  useEffect(() => {
    ensureYamlConfigured()
  }, [])

  // Apply backend cfn-lint diagnostics as editor markers whenever they change.
  useEffect(() => {
    const ed = editorRef.current
    const m = monacoRef.current
    if (!ed || !m) return
    const model = ed.getModel()
    if (!model) return
    const mapped = (markers || []).map((d) => ({
      severity: SEVERITY[d.level] ?? m.MarkerSeverity.Info,
      message: d.rule ? `${d.message} (${d.rule})` : d.message,
      startLineNumber: d.line || 1,
      startColumn: d.column || 1,
      endLineNumber: d.end_line || d.line || 1,
      endColumn: d.end_column || (d.column || 1) + 1,
      source: 'cfn-lint',
    }))
    m.editor.setModelMarkers(model, 'cfn-lint', mapped)
  }, [markers])

  return (
    <Editor
      height='100%'
      language='yaml'
      theme='vs-dark'
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={(editor, monacoInstance) => {
        editorRef.current = editor
        monacoRef.current = monacoInstance
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        links: false,
        folding: false,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        renderWhitespace: 'none',
      }}
    />
  )
}
