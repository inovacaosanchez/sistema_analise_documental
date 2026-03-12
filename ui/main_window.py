"""
INTERFACE PRINCIPAL COMPLETA
Janela principal com todos os controles necessários
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
import threading
from typing import List, Dict

from utils.logger import SystemLogger
from config.settings import Settings
from core.file_reader import FileReader
from core.chunking_engine import ChunkingEngine
from core.content_generator import ContentGenerator
from core.document_generator import DocumentGenerator
from ui.preview_window import PreviewWindow

class MainWindow:
    """Interface principal do sistema"""
    
    def __init__(self, root: tk.Tk, logger: SystemLogger):
        self.root = root
        self.logger = logger
        self.settings = Settings()
        
        # Componentes do sistema
        self.file_reader = FileReader(logger)
        self.chunking_engine = ChunkingEngine(logger)
        self.content_generator = ContentGenerator(logger)
        self.document_generator = DocumentGenerator(logger)
        
        # Estado da aplicação
        self.origem_path = ""
        self.destino_path = ""
        self.current_documents = []
        self.processing = False
        
        self.setup_ui()
        self.logger.info("🖥️ Interface principal inicializada")
    
    def setup_ui(self):
        """Configura interface do usuário"""
        # Configurar janela principal
        self.root.title("Sistema de Análise de Processos")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 700)
        
        # Estilo
        style = ttk.Style()
        style.theme_use('clam')
        
        # Frame principal simples
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Configurar seções
        self.setup_header(main_frame)
        self.setup_api_status(main_frame)
        self.setup_path_selection(main_frame)
        self.setup_control_panel(main_frame)
        self.setup_progress_section(main_frame)
        self.setup_documents_list(main_frame)
        self.setup_log_section(main_frame)
        
        # Testar API na inicialização
        self.test_api_connection()
    
    def setup_header(self, parent):
        """Configura cabeçalho"""
        header_frame = ttk.Frame(parent)
        header_frame.pack(fill=tk.X, pady=(0, 10))
        
        title_label = ttk.Label(
            header_frame,
            text="Sistema de Análise de Processos",
            font=("Arial", 16, "bold")
        )
        title_label.pack()
        
        subtitle_label = ttk.Label(
            header_frame,
            text="",
            font=("Arial", 10)
        )
        subtitle_label.pack(pady=(5, 0))
    
    def setup_api_status(self, parent):
        """Configura status da API"""
        api_frame = ttk.LabelFrame(parent, text="🤖 Status da API ChatGPT", padding="10")
        api_frame.pack(fill=tk.X, pady=(0, 10))
        
        status_frame = ttk.Frame(api_frame)
        status_frame.pack(fill=tk.X)
        
        self.api_status_label = ttk.Label(status_frame, text="🔄 Verificando...", 
                                         font=("Arial", 10))
        self.api_status_label.pack(side=tk.LEFT)
        
        ttk.Button(status_frame, text="🔄 Testar Conexão", 
                  command=self.test_api_connection, width=15).pack(side=tk.RIGHT)
    
    def setup_path_selection(self, parent):
        """Configura seleção de caminhos"""
        paths_frame = ttk.LabelFrame(parent, text="📁 Configuração de Caminhos", padding="10")
        paths_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Pasta de origem
        origem_frame = ttk.Frame(paths_frame)
        origem_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(origem_frame, text="📂 Pasta de Origem (DEPARTAMENTO/SUBAREA/):", 
                 font=("Arial", 10)).pack(anchor=tk.W)
        
        origem_input_frame = ttk.Frame(origem_frame)
        origem_input_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.origem_var = tk.StringVar()
        self.origem_entry = ttk.Entry(origem_input_frame, textvariable=self.origem_var, 
                                     state="readonly", font=("Arial", 9))
        self.origem_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        ttk.Button(origem_input_frame, text="📂 Selecionar", 
                  command=self.select_origem_path, width=12).pack(side=tk.RIGHT)
        
        # Pasta de destino
        destino_frame = ttk.Frame(paths_frame)
        destino_frame.pack(fill=tk.X)
        
        ttk.Label(destino_frame, text="📁 Pasta de Destino:", 
                 font=("Arial", 10)).pack(anchor=tk.W)
        
        destino_input_frame = ttk.Frame(destino_frame)
        destino_input_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.destino_var = tk.StringVar()
        self.destino_entry = ttk.Entry(destino_input_frame, textvariable=self.destino_var, 
                                      state="readonly", font=("Arial", 9))
        self.destino_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        ttk.Button(destino_input_frame, text="📁 Selecionar", 
                  command=self.select_destino_path, width=12).pack(side=tk.RIGHT)
    
    def setup_control_panel(self, parent):
        """Configura painel de controles"""
        control_frame = ttk.LabelFrame(parent, text="🎯 Controles de Processamento", padding="10")
        control_frame.pack(fill=tk.X, pady=(0, 10))
        
        buttons_frame = ttk.Frame(control_frame)
        buttons_frame.pack(fill=tk.X)
        
        # Botão escanear
        self.scan_button = ttk.Button(buttons_frame, text="🔍 Escanear Documentos", 
                                     command=self.scan_documents, width=20)
        self.scan_button.pack(side=tk.LEFT, padx=(0, 10))
        
        # Botão processar
        self.process_button = ttk.Button(buttons_frame, text="🚀 Processar Todos", 
                                        command=self.process_all_documents, 
                                        width=20, state=tk.DISABLED)
        self.process_button.pack(side=tk.LEFT, padx=(0, 10))
        
        # Botão parar
        self.stop_button = ttk.Button(buttons_frame, text="⏹️ Parar", 
                                     command=self.stop_processing, 
                                     width=12, state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT)
        
        # Status
        self.status_label = ttk.Label(control_frame, text="Pronto para iniciar", 
                                     font=("Arial", 9))
        self.status_label.pack(anchor=tk.W, pady=(10, 0))
    
    def setup_progress_section(self, parent):
        """Configura seção de progresso"""
        progress_frame = ttk.LabelFrame(parent, text="📊 Progresso", padding="10")
        progress_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Barra de progresso - SEM HEIGHT
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, 
                                           maximum=100, length=400)
        self.progress_bar.pack(fill=tk.X, pady=(0, 5))
        
        # Label de progresso
        self.progress_label = ttk.Label(progress_frame, text="0/0 documentos processados", 
                                       font=("Arial", 9))
        self.progress_label.pack()
    
    def setup_documents_list(self, parent):
        """Configura lista de documentos"""
        docs_frame = ttk.LabelFrame(parent, text="📄 Documentos Encontrados", padding="10")
        docs_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        # Treeview para documentos
        columns = ('Departamento', 'Subárea', 'Processo', 'Status', 'Ação')
        self.docs_tree = ttk.Treeview(docs_frame, columns=columns, show='headings', height=8)
        
        # Configurar colunas
        self.docs_tree.heading('Departamento', text='🏢 Departamento')
        self.docs_tree.heading('Subárea', text='📂 Subárea')
        self.docs_tree.heading('Processo', text='📄 Processo')
        self.docs_tree.heading('Status', text='📊 Status')
        self.docs_tree.heading('Ação', text='⚡ Ação')
        
        self.docs_tree.column('Departamento', width=150)
        self.docs_tree.column('Subárea', width=150)
        self.docs_tree.column('Processo', width=200)
        self.docs_tree.column('Status', width=120)
        self.docs_tree.column('Ação', width=100)
        
        # Scrollbar
        docs_scrollbar = ttk.Scrollbar(docs_frame, orient=tk.VERTICAL, 
                                      command=self.docs_tree.yview)
        self.docs_tree.configure(yscrollcommand=docs_scrollbar.set)
        
        self.docs_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        docs_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Bind para duplo clique
        self.docs_tree.bind('<Double-1>', self.on_document_double_click)
    
    def setup_log_section(self, parent):
        """Configura seção de log"""
        log_frame = ttk.LabelFrame(parent, text="📋 Log de Atividades", padding="10")
        log_frame.pack(fill=tk.BOTH, expand=True)
        
        # Área de log com scroll
        self.log_text = tk.Text(log_frame, wrap=tk.WORD, font=("Consolas", 9), 
                               height=12, state=tk.DISABLED)
        log_scrollbar = ttk.Scrollbar(log_frame, orient=tk.VERTICAL, 
                                     command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_scrollbar.set)
        
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        log_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Configurar logger para usar este widget
        self.logger.set_log_widget(self.log_text)
        
        # Botão limpar log
        clear_frame = ttk.Frame(log_frame)
        clear_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Button(clear_frame, text="🗑️ Limpar Log", 
                  command=self.clear_log, width=15).pack(side=tk.RIGHT)
    
    # === MÉTODOS DE AÇÃO ===
    
    def test_api_connection(self):
        """Testa conexão com API"""
        def test_thread():
            try:
                success, message = self.content_generator.test_api_connection()
                
                if success:
                    self.root.after(0, lambda: self.api_status_label.config(
                        text="✅ API Conectada", foreground="green"))
                else:
                    self.root.after(0, lambda: self.api_status_label.config(
                        text=f"❌ {message}", foreground="red"))
            
            except Exception as e:
                self.root.after(0, lambda: self.api_status_label.config(
                    text=f"❌ Erro: {str(e)[:50]}", foreground="red"))
        
        threading.Thread(target=test_thread, daemon=True).start()
    
    def select_origem_path(self):
        """Seleciona pasta de origem"""
        path = filedialog.askdirectory(title="Selecionar Pasta de Origem")
        if path:
            self.origem_path = path
            self.origem_var.set(path)
            self.logger.info(f"📂 Pasta de origem selecionada: {path}")
            self.validate_paths()
    
    def select_destino_path(self):
        """Seleciona pasta de destino"""
        path = filedialog.askdirectory(title="Selecionar Pasta de Destino")
        if path:
            self.destino_path = path
            self.destino_var.set(path)
            self.logger.info(f"📁 Pasta de destino selecionada: {path}")
            self.validate_paths()
    
    def validate_paths(self):
        """Valida caminhos selecionados"""
        if self.origem_path and self.destino_path:
            self.scan_button.config(state=tk.NORMAL)
        else:
            self.scan_button.config(state=tk.DISABLED)
    
    def scan_documents(self):
        """Escaneia documentos na pasta de origem"""
        def scan_thread():
            try:
                self.root.after(0, lambda: self.status_label.config(text="🔍 Escaneando documentos..."))
                
                documents = self.file_reader.scan_directory_structure(self.origem_path)
                
                self.root.after(0, lambda: self.update_documents_list(documents))
                self.root.after(0, lambda: self.status_label.config(text=f"✅ {len(documents)} documentos encontrados"))
                
                if documents:
                    self.root.after(0, lambda: self.process_button.config(state=tk.NORMAL))
            
            except Exception as e:
                self.root.after(0, lambda: self.status_label.config(text=f"❌ Erro: {str(e)}"))
                self.logger.error(f"Erro ao escanear: {e}")
        
        threading.Thread(target=scan_thread, daemon=True).start()
    
    def update_documents_list(self, documents):
        """Atualiza lista de documentos"""
        # Limpar lista atual
        for item in self.docs_tree.get_children():
            self.docs_tree.delete(item)
        
        self.current_documents = documents
        
        # Adicionar documentos
        for doc in documents:
            # Verificar se arquivos já existem
            output_path = Path(self.destino_path) / self.settings.get_output_folder_structure(
                doc['departamento'], doc['subarea'], doc['filename']
            )
            
            exists, existing_files = self.file_reader.check_output_files_exist(str(output_path))
            
            status = "📁 Já existe" if exists else "⏳ Pendente"
            action = "Pular" if exists else "Processar"
            
            self.docs_tree.insert('', tk.END, values=(
                doc['departamento'],
                doc['subarea'], 
                doc['filename'],
                status,
                action
            ))
    
    def process_all_documents(self):
        """Processa todos os documentos"""
        if not self.current_documents:
            messagebox.showwarning("Aviso", "Nenhum documento para processar")
            return
        
        if messagebox.askyesno("Confirmar", "Iniciar processamento de todos os documentos?"):
            self.start_processing()
    
    def start_processing(self):
        """Inicia processamento em thread separada"""
        self.processing = True
        self.process_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.scan_button.config(state=tk.DISABLED)
        
        def process_thread():
            try:
                total_docs = len(self.current_documents)
                
                for i, doc in enumerate(self.current_documents):
                    if not self.processing:
                        break
                    
                    self.root.after(0, lambda i=i, total=total_docs: 
                                   self.update_progress(i, total, "Processando..."))
                    
                    self.process_single_document(doc, i+1, total_docs)
                
                self.root.after(0, self.finish_processing)
            
            except Exception as e:
                self.logger.error(f"Erro no processamento: {e}")
                self.root.after(0, self.finish_processing)
        
        threading.Thread(target=process_thread, daemon=True).start()
    
    def process_single_document(self, doc, current, total):
        """Processa um único documento"""
        try:
            processo_name = doc['filename']
            self.logger.info(f"🔄 Processando {current}/{total}: {processo_name}")
            
            # Verificar se já existe
            output_path = Path(self.destino_path) / self.settings.get_output_folder_structure(
                doc['departamento'], doc['subarea'], processo_name
            )
            
            exists, existing_files = self.file_reader.check_output_files_exist(str(output_path))
            
            if exists:
                self.logger.info(f"⏭️ Pulando {processo_name} - arquivos já existem: {existing_files}")
                return
            
            # Ler documento
            titulo, texto_completo, texto_normalizado = self.file_reader.read_document_content(doc['file_path'])
            
            if not texto_normalizado:
                self.logger.error(f"❌ Falha ao ler {processo_name}")
                return
            
            # Fazer chunking
            chunks = self.chunking_engine.create_semantic_chunks(texto_normalizado)
            
            # Gerar conteúdo
            documents = self.content_generator.generate_all_documents(
                chunks, processo_name, doc['departamento'], doc['subarea']
            )
            
            if not documents:
                self.logger.error(f"❌ Falha na geração de conteúdo para {processo_name}")
                return
            
            # Mostrar preview e aguardar aprovação
            self.root.after(0, lambda: self.show_preview_and_save(documents, processo_name, str(output_path)))
            
        except Exception as e:
            self.logger.error(f"Erro ao processar {processo_name}: {e}")
    
    def show_preview_and_save(self, documents, processo_name, output_path):
        """Mostra preview e salva se aprovado"""
        def preview_callback(result):
            action, edited_docs = result
            
            if action == "approve" and edited_docs:
                # Salvar documentos
                results = self.document_generator.create_all_documents(
                    edited_docs, output_path, processo_name
                )
                
                success_count = sum(1 for success in results.values() if success)
                self.logger.info(f"✅ {success_count}/3 documentos salvos para {processo_name}")
            
            elif action == "regenerate":
                self.logger.info(f"🔄 Solicitada nova geração para {processo_name}")
                # Aqui você poderia implementar nova geração
            
            else:
                self.logger.info(f"❌ Geração cancelada para {processo_name}")
        
        # Criar e mostrar janela de preview
        preview_window = PreviewWindow(self.root, documents, processo_name, preview_callback)
        preview_window.show()
    
    def update_progress(self, current, total, status):
        """Atualiza progresso"""
        progress = (current / total) * 100 if total > 0 else 0
        self.progress_var.set(progress)
        self.progress_label.config(text=f"{current}/{total} documentos processados")
        self.status_label.config(text=status)
    
    def stop_processing(self):
        """Para processamento"""
        self.processing = False
        self.logger.info("⏹️ Processamento interrompido pelo usuário")
        self.finish_processing()
    
    def finish_processing(self):
        """Finaliza processamento"""
        self.processing = False
        self.process_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
        self.scan_button.config(state=tk.NORMAL)
        self.status_label.config(text="✅ Processamento concluído")
        self.progress_var.set(100)
    
    def on_document_double_click(self, event):
        """Ação de duplo clique em documento"""
        selection = self.docs_tree.selection()
        if selection:
            item = self.docs_tree.item(selection[0])
            values = item['values']
            messagebox.showinfo("Documento", f"Processo: {values[2]}\nStatus: {values[3]}")
    
    def clear_log(self):
        """Limpa log"""
        self.logger.clear_log()