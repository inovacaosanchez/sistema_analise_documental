"""
FUNÇÕES AUXILIARES
Utilitários gerais do sistema
"""

import re
from pathlib import Path
from typing import List, Dict, Tuple
import unicodedata

def normalize_filename(filename: str) -> str:
    """Normaliza nome de arquivo removendo caracteres especiais"""
    # Remover acentos
    filename = unicodedata.normalize('NFD', filename)
    filename = ''.join(c for c in filename if unicodedata.category(c) != 'Mn')
    
    # Remover caracteres especiais
    filename = re.sub(r'[<>:"/\|?*]', '_', filename)
    
    # Remover espaços múltiplos
    filename = re.sub(r'\s+', '_', filename)
    
    # Limitar tamanho
    if len(filename) > 100:
        filename = filename[:100]
    
    return filename.strip('_')

def validate_directory_structure(path: str) -> Tuple[bool, str]:
    """Valida estrutura de diretórios esperada"""
    path = Path(path)
    
    if not path.exists():
        return False, "Diretório não existe"
    
    if not path.is_dir():
        return False, "Caminho não é um diretório"
    
    # Verificar se tem subdiretórios (departamentos)
    subdirs = [p for p in path.iterdir() if p.is_dir()]
    
    if not subdirs:
        return False, "Nenhum departamento encontrado"
    
    # Verificar estrutura DEPARTAMENTO/SUBAREA
    valid_structure = False
    for dept in subdirs:
        subareas = [p for p in dept.iterdir() if p.is_dir()]
        if subareas:
            valid_structure = True
            break
    
    if not valid_structure:
        return False, "Estrutura DEPARTAMENTO/SUBAREA não encontrada"
    
    return True, "Estrutura válida"

def extract_process_name_from_title(title: str, filename: str) -> str:
    """Extrai nome do processo do título ou filename"""
    if title and len(title.strip()) > 3:
        # Usar título se disponível
        process_name = title.strip()
    else:
        # Usar filename como fallback
        process_name = Path(filename).stem
    
    # Normalizar nome
    process_name = normalize_filename(process_name)
    
    return process_name

def format_file_size(size_bytes: int) -> str:
    """Formata tamanho de arquivo"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024**2:
        return f"{size_bytes/1024:.1f} KB"
    elif size_bytes < 1024**3:
        return f"{size_bytes/(1024**2):.1f} MB"
    else:
        return f"{size_bytes/(1024**3):.1f} GB"

def truncate_text(text: str, max_length: int = 100) -> str:
    """Trunca texto para exibição"""
    if len(text) <= max_length:
        return text
    
    return text[:max_length-3] + "..."

def validate_api_key_format(api_key: str) -> bool:
    """Valida formato básico da API key"""
    if not api_key:
        return False
    
    # OpenAI API keys começam com 'sk-'
    if not api_key.startswith('sk-'):
        return False
    
    # Tamanho mínimo
    if len(api_key) < 20:
        return False
    
    return True