import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef
} from '@angular/core';

import * as monaco from 'monaco-editor';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import * as prettier from 'prettier/standalone';
import * as parserHtml from 'prettier/parser-html';
import * as parserBabel from 'prettier/parser-babel';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {

  @ViewChild('editor', { static: true }) editorRef!: ElementRef;

  editor: any;
  webcontainerInstance: any;
  terminal: Terminal;
  fitAddon: FitAddon;

  editorWidth = window.innerWidth * 0.6;
  terminalHeight = 180;

  isResizing = false;
  isVerticalResizing = false;

  openFiles: string[] = ['index.html']; // opened tabs
  activeFile = 'index.html';

  fileList: string[] = [];

  files: any = {
    'index.html': {
      file: {
        contents: `
        <!DOCTYPE html>
        <html>
          <body>
            <h1>Hello StackBlitz Clone 🚀</h1>
            <script src="main.js"></script>
          </body>
        </html>
        `
      }
    },
    'main.js': {
      file: {
        contents: `console.log('JS Loaded!');`
      }
    },
    'package.json': {
      file: {
        contents: JSON.stringify({
          name: 'preview-app',
          scripts: {
            start: 'vite'
          },
          devDependencies: {
            vite: '^5.0.0'
          }
        })
      }
    }
  };

  constructor() {
    this.terminal = new Terminal();
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
  }

  ngOnInit() {
    this.fileList = Object.keys(this.files);
  }

  async ngAfterViewInit() {
    this.initEditor();
    this.initTerminal();
    await this.initWebContainer();
  }

  // =============================
  // 📝 Monaco Editor Setup
  // =============================
  initEditor() {
    this.editor = monaco.editor.create(this.editorRef.nativeElement, {
      value: this.files[this.activeFile].file.contents,
      language: 'html',
      theme: 'vs-dark',
      automaticLayout: true
    });

    this.editor.onDidChangeModelContent(() => {
      const code = this.editor.getValue();
      this.files[this.activeFile].file.contents = code;
      this.updatePreview();
    });

    // 🔥 force layout once
    setTimeout(() => {
      this.editor.layout();
      this.editor.focus();
    }, 100);
  }

  // =============================
  // 📁 File Switching
  // =============================
  openFile(file: string) {
    this.activeFile = file;

    // ✅ Add to tabs if not already open
    if (!this.openFiles.includes(file)) {
      this.openFiles.push(file);
    }

    const content = this.files[file].file.contents;

    const language = file.endsWith('.html')
      ? 'html'
      : file.endsWith('.js')
      ? 'javascript'
      : 'json';

    monaco.editor.setModelLanguage(this.editor.getModel(), language);
    this.editor.setValue(content);

    this.editor.focus();
  }

  // =============================
  // 🚀 WebContainer Setup
  // =============================
  async initWebContainer() {
    this.webcontainerInstance = await WebContainer.boot();

    await this.webcontainerInstance.mount(this.files);

    // ✅ STEP 1: install dependencies
    const installProcess = await this.webcontainerInstance.spawn('npm', ['install']);

    await installProcess.exit; // wait until install finishes

    this.terminal.writeln('📦 Dependencies installed\n');

    // ✅ STEP 2: start server
    const process = await this.webcontainerInstance.spawn('npm', ['run', 'start']);

    process.output.pipeTo(
      new WritableStream({
        write: (data) => this.terminal.write(data)
      })
    );

    // ✅ STEP 3: preview
    this.webcontainerInstance.on('server-ready', (_port: number, url: string) => {
      const iframe: any = document.getElementById('preview');
      iframe.src = url;
    });
  }

  // =============================
  // 🔄 Live Preview Update
  // =============================
  async updatePreview() {
    if (!this.webcontainerInstance) return;

    await this.webcontainerInstance.mount(this.files);
  }

  // =============================
  // ▶ Run Project
  // =============================
  async runProject() {
    this.terminal.writeln('\n🚀 Re-running project...\n');

    await this.webcontainerInstance.mount(this.files);

    const process = await this.webcontainerInstance.spawn('npm', ['run', 'start']);

    process.output.pipeTo(
      new WritableStream({
        write: (data) => this.terminal.write(data)
      })
    );
  }

  // =============================
  // 💻 Terminal Setup
  // =============================
  initTerminal() {
    const terminalEl = document.getElementById('terminal');

    if (terminalEl) {
      this.terminal.open(terminalEl);
      this.fitAddon.fit();
      this.terminal.writeln('⚡ WebContainer Terminal Ready\r\n');
    }
  }

  // =============================
  // ✨ Format Code
  // =============================
  async formatCode() {
    const code = this.editor.getValue();

    try {
      const formatted = await prettier.format(code, {
        parser: this.activeFile.endsWith('.html') ? 'html' : 'babel',
        plugins: [parserHtml, parserBabel]
      });

      const model = this.editor.getModel();
      model?.setValue(formatted);

    } catch (err) {
      console.error(err);
    }
  }

  // =============================
  // ✨ Close File
  // =============================

  closeFile(file: string, event: MouseEvent) {
    event.stopPropagation(); // prevent switching

    this.openFiles = this.openFiles.filter(f => f !== file);

    // If closing active file → switch to another
    if (this.activeFile === file) {
      this.activeFile = this.openFiles[this.openFiles.length - 1] || '';

      if (this.activeFile) {
        this.openFile(this.activeFile);
      }
    }
  }

  startResize(event: MouseEvent) {
    this.isResizing = true;

    document.addEventListener('mousemove', this.resize);
    document.addEventListener('mouseup', this.stopResize);
  }

  resize = (event: MouseEvent) => {
    if (!this.isResizing) return;

    this.editorWidth = event.clientX - 200;

    // 🔥 VERY IMPORTANT
    setTimeout(() => {
      this.editor.layout();
    }, 0);
  };

  stopResize = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.resize);
    document.removeEventListener('mouseup', this.stopResize);
  };

  startVerticalResize(event: MouseEvent) {
    this.isVerticalResizing = true;

    document.addEventListener('mousemove', this.resizeVertical);
    document.addEventListener('mouseup', this.stopVerticalResize);
  }

  resizeVertical = (event: MouseEvent) => {
    if (!this.isVerticalResizing) return;
    this.terminalHeight = window.innerHeight - event.clientY;
  };

  stopVerticalResize = () => {
    this.isVerticalResizing = false;
    document.removeEventListener('mousemove', this.resizeVertical);
    document.removeEventListener('mouseup', this.stopVerticalResize);
  };
}