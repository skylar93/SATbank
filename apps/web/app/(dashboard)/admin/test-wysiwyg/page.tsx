'use client'

import { useState } from 'react'
import { WysiwygEditor } from '../../../../components/wysiwyg-editor'
import { ContentRenderer } from '../../../../components/content-renderer'

export default function TestWysiwygPage() {
  const [content, setContent] = useState('')
  const [rawHtml, setRawHtml] = useState('')

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setRawHtml(newContent)
  }

  const testPresets = {
    empty: '',
    basicText: '<p>This is a basic paragraph with <strong>bold</strong> and <em>italic</em> text.</p>',
    mathExpressions: '<p>Here is an inline math expression: <span class="bg-purple-100 px-1 rounded text-purple-800 font-mono">2^x</span> and another: <span class="bg-purple-100 px-1 rounded text-purple-800 font-mono">x^2 + y^2 = z^2</span></p><p>And here is a block math expression:</p><p><span class="bg-purple-100 px-2 py-1 rounded text-purple-800 font-mono block my-2">$$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$</span></p>',
    withTable: '<table class="border-collapse border border-gray-300 w-full my-4"><thead><tr class="border border-gray-300"><th class="border border-gray-300 bg-gray-50 px-4 py-2 text-left font-semibold">Column 1</th><th class="border border-gray-300 bg-gray-50 px-4 py-2 text-left font-semibold">Column 2</th><th class="border border-gray-300 bg-gray-50 px-4 py-2 text-left font-semibold">Column 3</th></tr></thead><tbody><tr class="border border-gray-300"><td class="border border-gray-300 px-4 py-2">Data 1</td><td class="border border-gray-300 px-4 py-2">Data 2</td><td class="border border-gray-300 px-4 py-2">Data 3</td></tr><tr class="border border-gray-300"><td class="border border-gray-300 px-4 py-2">More data</td><td class="border border-gray-300 px-4 py-2">More data</td><td class="border border-gray-300 px-4 py-2">More data</td></tr></tbody></table>',
    complexContent: '<h2>SAT Reading Question</h2><p>The following passage is about climate change and its effects on polar regions.</p><blockquote><p>"The Arctic ice is melting at an unprecedented rate, with some scientists predicting complete summer ice-free conditions by 2030."</p></blockquote><p>According to the passage, what can be inferred about the Arctic ice?</p><ul><li>A) It will completely disappear by 2025</li><li>B) Scientists disagree about the melting timeline</li><li>C) Summer conditions may see no ice by 2030</li><li>D) The melting rate is slower than expected</li></ul><hr><p><strong>Explanation:</strong> The correct answer is C. The passage specifically mentions "complete summer ice-free conditions by 2030."</p>'
  }

  const loadPreset = (presetName: keyof typeof testPresets) => {
    const presetContent = testPresets[presetName]
    setContent(presetContent)
    setRawHtml(presetContent)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">WYSIWYG Editor Test Page</h1>
          <p className="text-gray-600 mb-6">
            Test all features of the Tiptap WYSIWYG editor before integrating into the main application.
          </p>

          {/* Preset Buttons */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Presets:</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadPreset('empty')}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Empty
              </button>
              <button
                onClick={() => loadPreset('basicText')}
                className="px-3 py-1 bg-blue-200 text-blue-700 rounded hover:bg-blue-300"
              >
                Basic Text
              </button>
              <button
                onClick={() => loadPreset('mathExpressions')}
                className="px-3 py-1 bg-purple-200 text-purple-700 rounded hover:bg-purple-300"
              >
                Math Expressions
              </button>
              <button
                onClick={() => loadPreset('withTable')}
                className="px-3 py-1 bg-green-200 text-green-700 rounded hover:bg-green-300"
              >
                With Table
              </button>
              <button
                onClick={() => loadPreset('complexContent')}
                className="px-3 py-1 bg-orange-200 text-orange-700 rounded hover:bg-orange-300"
              >
                Complex Content
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">WYSIWYG Editor:</h3>
            <WysiwygEditor
              content={content}
              onChange={handleContentChange}
              placeholder="Start typing your content here..."
              className="min-h-[300px]"
              rows={12}
            />
          </div>

          {/* Test Checklist */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Feature Test Checklist:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Bold, Italic, Underline formatting
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Headings (H2, H3)
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Bullet and Numbered Lists
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Blockquotes
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Horizontal Rules
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Table Creation/Editing
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Image Upload/Insert
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Line Breaks
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Math Expression Handling
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Copy/Paste Functionality
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Undo/Redo (Ctrl+Z/Ctrl+Y)
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                Text Alignment (Left, Center, Right)
              </label>
              <label className="flex items-center text-blue-800">
                <input type="checkbox" className="mr-2" />
                No SSR/Hydration Errors
              </label>
            </div>
          </div>
        </div>

        {/* Output Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Raw HTML Output */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Raw HTML Output:</h3>
            <div className="bg-gray-100 p-4 rounded border overflow-auto max-h-96">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {rawHtml || '<p>No content yet...</p>'}
              </pre>
            </div>
          </div>

          {/* Rendered Preview */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Rendered Preview:</h3>
            <div className="bg-gray-50 p-4 rounded border min-h-96">
              {rawHtml ? (
                <ContentRenderer htmlContent={rawHtml} />
              ) : (
                <p className="text-gray-500">No content yet...</p>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">Testing Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-800">
            <li>Use the preset buttons to load different types of content</li>
            <li>Try editing the content using the toolbar buttons</li>
            <li>Test each feature in the checklist above</li>
            <li>Check that the Raw HTML Output looks correct</li>
            <li>Verify that the Rendered Preview displays properly</li>
            <li>Watch the browser console for any errors</li>
            <li>Test on both desktop and mobile viewport sizes</li>
          </ol>
        </div>
      </div>
    </div>
  )
}