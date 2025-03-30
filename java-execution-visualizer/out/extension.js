"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const highlightQueue = [];
const HIGHLIGHT_INTERVAL = 100; //ms
let highlightDecoration;
function activate(context) {
    console.log('Java Execution Visualizer activated');
    highlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)'
    });
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('java', {
        createDebugAdapterTracker(session) {
            return {
                onDidSendMessage: msg => {
                    if (msg.type === 'event' && msg.event === 'output') {
                        const output = msg.body.output?.trim();
                        console.log('[Tracker] Output:', output);
                        if (output && output.startsWith('VISUALIZER::')) {
                            handleVisualizerOutput(output);
                        }
                    }
                }
            };
        }
    }));
    setInterval(() => {
        if (highlightQueue.length > 0) {
            const { editor, range } = highlightQueue.shift();
            editor.setDecorations(highlightDecoration, [range]);
        }
    }, HIGHLIGHT_INTERVAL);
}
function deactivate() {
    clearHighlights();
}
// Highlight current execution line
async function updateCurrentExecutionLine() {
    const session = vscode.debug.activeDebugSession;
    if (!session) {
        console.log('No active debug session');
        return;
    }
    try {
        const threads = await session.customRequest('threads');
        const threadId = threads.threads[0]?.id;
        console.log('Using thread ID:', threadId);
        const stackTrace = await session.customRequest('stackTrace', {
            threadId,
            startFrame: 0,
            levels: 1
        });
        const frame = stackTrace.stackFrames[0];
        console.log('Current frame:', frame);
        if (!frame || !frame.source?.path) {
            return;
        }
        const uri = vscode.Uri.file(frame.source.path);
        const editor = await vscode.window.showTextDocument(uri, { preview: false });
        const range = new vscode.Range(frame.line - 1, 0, frame.line - 1, editor.document.lineAt(frame.line - 1).range.end.character);
        console.log('Applying highlight to:', range);
        editor.setDecorations(highlightDecoration, [range]);
    }
    catch (error) {
        console.error('Failed to highlight execution line:', error);
    }
}
function handleVisualizerOutput(line) {
    console.log('[Visualizer] Received line:', line);
    if (!line.startsWith('VISUALIZER::')) {
        return;
    }
    const match = line.match(/VISUALIZER::(.+?)\.java::LINE::(\d+)/);
    if (!match) {
        return;
    }
    const [_, filename, lineStr] = match;
    const lineNumber = parseInt(lineStr, 10) - 1;
    const editor = vscode.window.visibleTextEditors.find(ed => ed.document.fileName.endsWith(`${filename}.java`));
    if (!editor) {
        console.log(`No open editor for ${filename}.java`);
        return;
    }
    const range = new vscode.Range(lineNumber, 0, lineNumber, editor.document.lineAt(lineNumber).range.end.character);
    highlightQueue.push({ editor, range }); // ⬅️ add to queue instead of immediate
}
// Clear all highlights
function clearHighlights() {
    vscode.window.visibleTextEditors.forEach(editor => {
        editor.setDecorations(highlightDecoration, []);
    });
}
//# sourceMappingURL=extension.js.map