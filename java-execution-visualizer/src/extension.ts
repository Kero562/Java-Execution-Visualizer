import * as vscode from 'vscode';

const highlightQueue: { editor: vscode.TextEditor, range: vscode.Range }[] = [];
const HIGHLIGHT_INTERVAL = 100; //ms

let highlightDecoration: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
	console.log('Java Execution Visualizer activated');

	highlightDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(255, 255, 0, 0.3)'
	});

	context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('java', {
		createDebugAdapterTracker(session: vscode.DebugSession) {
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
			const { editor, range } = highlightQueue.shift()!;
			editor.setDecorations(highlightDecoration, [range]);
		}
	}, HIGHLIGHT_INTERVAL);	
}

export function deactivate() {
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

		if (!frame || !frame.source?.path) 
			{
				return;
			}

		const uri = vscode.Uri.file(frame.source.path);
		const editor = await vscode.window.showTextDocument(uri, { preview: false });

		const range = new vscode.Range(
			frame.line - 1, 0,
			frame.line - 1, editor.document.lineAt(frame.line - 1).range.end.character
		);

		console.log('Applying highlight to:', range);
		editor.setDecorations(highlightDecoration, [range]);

	} catch (error) {
		console.error('Failed to highlight execution line:', error);
	}
}

function handleVisualizerOutput(line: string) {
	console.log('[Visualizer] Received line:', line);
	if (!line.startsWith('VISUALIZER::')) 
		{return;}

	const match = line.match(/VISUALIZER::(.+?)\.java::LINE::(\d+)/);
	if (!match) 
		{return;}

	const [_, filename, lineStr] = match;
	const lineNumber = parseInt(lineStr, 10) - 1;

	const editor = vscode.window.visibleTextEditors.find(ed =>
		ed.document.fileName.endsWith(`${filename}.java`)
	);

	if (!editor) {
		console.log(`No open editor for ${filename}.java`);
		return;
	}

	const range = new vscode.Range(
		lineNumber, 0,
		lineNumber, editor.document.lineAt(lineNumber).range.end.character
	);

	highlightQueue.push({ editor, range }); // ⬅️ add to queue instead of immediate
}


// Clear all highlights
function clearHighlights() {
	vscode.window.visibleTextEditors.forEach(editor => {
		editor.setDecorations(highlightDecoration, []);
	});
}
