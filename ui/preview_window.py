"""
JANELA DE PRÉ-VISUALIZAÇÃO
Permite validação humana antes de salvar documentos
"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import Dict, Callable

class PreviewWindow:
    """Janela de pré-visualização de documentos"""
    
    def __init__(self, parent, documents: Dict[str, str], 
                 processo_name: str, callback: Callable):
        self.parent = parent
        self.documents = documents
        self.processo_name = processo_name
        self.callback = callback
        
        self.window = None
        self.result = None
        
        self.create_window()
    
    def create_window(self):
        """Cria janela de pré-visualização"""
        self.window = tk.Toplevel(self.parent)
        self.window.title(f"Pré-visualização - {self.processo_name}")
        self.window.geometry("1000x700")
        self.window.transient(self.parent)
        self.window.grab_set()
        
        # Frame principal
        main_frame = ttk.Frame(self.window, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Cabeçalho
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 15))
        
        ttk.Label(header_frame, text=f"📋 Pré-visualização: {self.processo_name}", 
                 font=("Arial", 14, "bold")).pack()
        
        ttk.Label(header_frame, text="Revise o conteúdo gerado antes de salvar", 
                 font=("Arial", 10)).pack(pady=(5, 0))
        
        # Notebook para abas
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True, pady=(0, 15))
        
        # Criar abas para cada documento
        self.text_widgets = {}
        self.create_document_tabs()
        
        # Botões de ação
        buttons_frame = ttk.Frame(main_frame)
        buttons_frame.pack(fill=tk.X)
        
        ttk.Button(buttons_frame, text="✅ Aprovar e Salvar", 
                  command=self.approve_documents, width=20).pack(side=tk.LEFT, padx=(0, 10))
              
        ttk.Button(buttons_frame, text="❌ Cancelar", 
                  command=self.cancel_preview, width=15).pack(side=tk.RIGHT)
        
        # Centralizar janela
        self.center_window()
    
    def create_document_tabs(self):
        """Cria abas para cada documento"""
        doc_titles = {
            'ficha_tecnica': '📋 Ficha Técnica',
            'fluxograma': '🔄 Fluxograma Mermaid',
            'riscos': '⚠️ Riscos e Automação'
        }
        
        for doc_key, title in doc_titles.items():
            if doc_key in self.documents:
                # Frame da aba
                tab_frame = ttk.Frame(self.notebook)
                self.notebook.add(tab_frame, text=title)
                
                # Área de texto com scroll
                text_frame = ttk.Frame(tab_frame)
                text_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)  # ✅ CORRIGIDO
                
                # Text widget
                text_widget = tk.Text(text_frame, wrap=tk.WORD, font=("Consolas", 10))
                scrollbar = ttk.Scrollbar(text_frame, orient=tk.VERTICAL, 
                                        command=text_widget.yview)
                text_widget.configure(yscrollcommand=scrollbar.set)
                
                # Inserir conteúdo
                text_widget.insert(tk.END, self.documents[doc_key])
                
                # Pack widgets
                text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
                scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
                
                # Salvar referência
                self.text_widgets[doc_key] = text_widget
    
    def center_window(self):
        """Centraliza janela na tela"""
        self.window.update_idletasks()
        
        width = self.window.winfo_width()
        height = self.window.winfo_height()
        
        screen_width = self.window.winfo_screenwidth()
        screen_height = self.window.winfo_screenheight()
        
        x = (screen_width - width) // 2
        y = (screen_height - height) // 2
        
        self.window.geometry(f"{width}x{height}+{x}+{y}")
    
    def approve_documents(self):
        """Aprova documentos para salvamento"""
        try:
            # Coletar conteúdo editado
            edited_documents = {}
            for doc_key, text_widget in self.text_widgets.items():
                edited_documents[doc_key] = text_widget.get(1.0, tk.END).strip()
            
            # Validar conteúdo mínimo
            for doc_key, content in edited_documents.items():
                if len(content) < 50:
                    messagebox.showwarning(
                        "Conteúdo Insuficiente",
                        f"O documento {doc_key} tem conteúdo muito curto.\n"
                        "Verifique se foi gerado corretamente."
                    )
                    return
            
            # Confirmar salvamento
            if messagebox.askyesno(
                "Confirmar Salvamento",
                f"Salvar os 3 documentos para:\n{self.processo_name}?\n\n"
                "Esta ação não pode ser desfeita."
            ):
                self.result = ("approve", edited_documents)
                self.close_window()
        
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao aprovar documentos:\n{e}")
    
    
    
    def cancel_preview(self):
        """Cancela pré-visualização"""
        if messagebox.askyesno(
            "Cancelar",
            "Deseja cancelar a geração dos documentos?\n\n"
            "Nenhum arquivo será salvo."
        ):
            self.result = ("cancel", None)
            self.close_window()
    
    def close_window(self):
        """Fecha janela e executa callback"""
        if self.callback and self.result:
            self.callback(self.result)
        
        self.window.destroy()
    
    def show(self):
        """Exibe janela e aguarda resultado"""
        self.window.wait_window()
        return self.result