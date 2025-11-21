import * as vscode from 'vscode';

class HelloWorldViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            const item = new vscode.TreeItem('Click to say Hello World!', vscode.TreeItemCollapsibleState.None);
            item.command = {
                command: 'test-hello-world.helloWorld',
                title: 'Say Hello'
            };
            item.iconPath = new vscode.ThemeIcon('smiley');
            return Promise.resolve([item]);
        }
        return Promise.resolve([]);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "test-hello-world" is now active!');

    // Register the command
    const disposable = vscode.commands.registerCommand('test-hello-world.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World!');
    });

    context.subscriptions.push(disposable);

    // Register TreeView
    const treeDataProvider = new HelloWorldViewProvider();
    vscode.window.registerTreeDataProvider('test-hello-world-view', treeDataProvider);

    // Create a status bar item
    const myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'test-hello-world.helloWorld';
    myStatusBarItem.text = '$(smiley) Hello';
    myStatusBarItem.tooltip = 'Click me for Hello World';
    myStatusBarItem.show();

    context.subscriptions.push(myStatusBarItem);
}

export function deactivate() { }
