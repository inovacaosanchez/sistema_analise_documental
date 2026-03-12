"""
MOTOR DE CHUNKING
Responsável por quebrar texto em chunks semânticos
"""

import re
from typing import List, Dict
from dataclasses import dataclass

from utils.logger import SystemLogger
from config.settings import Settings

@dataclass
class TextChunk:
    """Representação de um chunk de texto"""
    id: int
    text: str
    start_position: int
    end_position: int
    semantic_break_reason: str = ""
    word_count: int = 0
    char_count: int = 0

class ChunkingEngine:
    """Motor de chunking semântico"""
    
    def __init__(self, logger: SystemLogger):
        self.logger = logger
        self.settings = Settings()
    
    def create_semantic_chunks(self, text: str) -> List[TextChunk]:
        """
        Cria chunks semânticos do texto
        Prioriza quebras semânticas sobre tamanho fixo
        """
        self.logger.info("🔄 Iniciando chunking semântico")
        
        if not text or len(text.strip()) == 0:
            self.logger.warning("⚠️ Texto vazio para chunking")
            return []
        
        # Normalizar texto para análise
        normalized_text = self._prepare_text_for_chunking(text)
        
        # Identificar pontos de quebra semântica
        break_points = self._find_semantic_break_points(normalized_text)
        
        # Criar chunks baseados nos pontos de quebra
        chunks = self._create_chunks_from_breaks(normalized_text, break_points)
        
        # Validar e ajustar chunks
        validated_chunks = self._validate_and_adjust_chunks(chunks)
        
        self.logger.info(f"✅ Chunking concluído: {len(validated_chunks)} chunks criados")
        
        # Log detalhado de cada chunk
        for chunk in validated_chunks:
            self.logger.debug(f"Chunk {chunk.id}: {chunk.char_count} chars, razão: {chunk.semantic_break_reason}")
        
        return validated_chunks
    
    def _prepare_text_for_chunking(self, text: str) -> str:
        """Prepara texto para análise de chunking"""
        # Normalizar quebras de linha
        text = re.sub(r'\n{2,}', '\n\n', text)
        
        # Garantir espaço após pontos
        text = re.sub(r'\.([A-Z])', r'. \1', text)
        
        return text.strip()
    
    def _find_semantic_break_points(self, text: str) -> List[Dict]:
        """Encontra pontos de quebra semântica no texto"""
        break_points = []
        
        # Quebras por parágrafos (alta prioridade)
        paragraph_breaks = self._find_paragraph_breaks(text)
        break_points.extend(paragraph_breaks)
        
        # Quebras por palavras-chave semânticas
        keyword_breaks = self._find_keyword_breaks(text)
        break_points.extend(keyword_breaks)
        
        # Quebras por mudança de contexto
        context_breaks = self._find_context_breaks(text)
        break_points.extend(context_breaks)
        
        # Ordenar por posição
        break_points.sort(key=lambda x: x['position'])
        
        # Remover duplicatas próximas
        break_points = self._remove_close_breaks(break_points)
        
        self.logger.debug(f"Encontrados {len(break_points)} pontos de quebra semântica")
        return break_points
    
    def _find_paragraph_breaks(self, text: str) -> List[Dict]:
        """Encontra quebras por parágrafos"""
        breaks = []
        
        for match in re.finditer(r'\n\n+', text):
            breaks.append({
                'position': match.end(),
                'reason': 'paragraph_break',
                'priority': 1
            })
        
        return breaks
    
    def _find_keyword_breaks(self, text: str) -> List[Dict]:
        """Encontra quebras por palavras-chave semânticas"""
        breaks = []
        
        for keyword in self.settings.SEMANTIC_BREAK_KEYWORDS:
            # Procurar palavra-chave no início de sentenças
            pattern = r'(?:^|\. |\n)(' + re.escape(keyword) + r')\b'
            
            for match in re.finditer(pattern, text, re.IGNORECASE):
                breaks.append({
                    'position': match.start(),
                    'reason': f'keyword: {keyword}',
                    'priority': 2
                })
        
        return breaks
    
    def _find_context_breaks(self, text: str) -> List[Dict]:
        """Encontra quebras por mudança de contexto"""
        breaks = []
        
        # Quebras por listas numeradas
        for match in re.finditer(r'\n\s*\d+[\.\)]\s+', text):
            breaks.append({
                'position': match.start(),
                'reason': 'numbered_list',
                'priority': 3
            })
        
        # Quebras por listas com marcadores
        for match in re.finditer(r'\n\s*[-•*]\s+', text):
            breaks.append({
                'position': match.start(),
                'reason': 'bullet_list',
                'priority': 3
            })
        
        return breaks
    
    def _remove_close_breaks(self, break_points: List[Dict], min_distance: int = 50) -> List[Dict]:
        """Remove pontos de quebra muito próximos"""
        if not break_points:
            return break_points
        
        filtered_breaks = [break_points[0]]
        
        for current_break in break_points[1:]:
            last_break = filtered_breaks[-1]
            
            if current_break['position'] - last_break['position'] >= min_distance:
                filtered_breaks.append(current_break)
            elif current_break['priority'] < last_break['priority']:
                # Substituir por quebra de maior prioridade
                filtered_breaks[-1] = current_break
        
        return filtered_breaks
    
    def _create_chunks_from_breaks(self, text: str, break_points: List[Dict]) -> List[TextChunk]:
        """Cria chunks baseado nos pontos de quebra"""
        chunks = []
        
        if not break_points:
            # Se não há quebras, criar chunk único
            chunk = self._create_single_chunk(text, 0, 0, len(text), "no_breaks")
            return [chunk]
        
        # Primeiro chunk (início até primeira quebra)
        first_break = break_points[0]
        if first_break['position'] > 0:
            chunk = self._create_single_chunk(
                text, 0, 0, first_break['position'], "start_to_first_break"
            )
            chunks.append(chunk)
        
        # Chunks intermediários
        for i, break_point in enumerate(break_points[:-1]):
            start_pos = break_point['position']
            end_pos = break_points[i + 1]['position']
            
            chunk = self._create_single_chunk(
                text, len(chunks), start_pos, end_pos, break_point['reason']
            )
            chunks.append(chunk)
        
        # Último chunk
        last_break = break_points[-1]
        if last_break['position'] < len(text):
            chunk = self._create_single_chunk(
                text, len(chunks), last_break['position'], len(text), last_break['reason']
            )
            chunks.append(chunk)
        
        return chunks
    
    def _create_single_chunk(self, text: str, chunk_id: int, start_pos: int, 
                           end_pos: int, reason: str) -> TextChunk:
        """Cria um único chunk"""
        chunk_text = text[start_pos:end_pos].strip()
        
        return TextChunk(
            id=chunk_id,
            text=chunk_text,
            start_position=start_pos,
            end_position=end_pos,
            semantic_break_reason=reason,
            word_count=len(chunk_text.split()),
            char_count=len(chunk_text)
        )
    
    def _validate_and_adjust_chunks(self, chunks: List[TextChunk]) -> List[TextChunk]:
        """Valida e ajusta chunks conforme configurações"""
        validated_chunks = []
        
        for chunk in chunks:
            # Verificar tamanho mínimo
            if chunk.char_count < self.settings.MIN_CHUNK_SIZE:
                # Tentar mesclar com chunk anterior ou próximo
                if validated_chunks:
                    # Mesclar com anterior
                    last_chunk = validated_chunks[-1]
                    merged_chunk = self._merge_chunks(last_chunk, chunk)
                    validated_chunks[-1] = merged_chunk
                    self.logger.debug(f"Chunk {chunk.id} mesclado com anterior (muito pequeno)")
                    continue
            
            # Verificar tamanho máximo
            if chunk.char_count > self.settings.MAX_CHUNK_SIZE:
                # Dividir chunk grande
                sub_chunks = self._split_large_chunk(chunk)
                validated_chunks.extend(sub_chunks)
                self.logger.debug(f"Chunk {chunk.id} dividido em {len(sub_chunks)} sub-chunks")
            else:
                validated_chunks.append(chunk)
        
        # Reindexar chunks
        for i, chunk in enumerate(validated_chunks):
            chunk.id = i
        
        return validated_chunks
    
    def _merge_chunks(self, chunk1: TextChunk, chunk2: TextChunk) -> TextChunk:
        """Mescla dois chunks"""
        merged_text = chunk1.text + "\n\n" + chunk2.text
        
        return TextChunk(
            id=chunk1.id,
            text=merged_text,
            start_position=chunk1.start_position,
            end_position=chunk2.end_position,
            semantic_break_reason=f"merged: {chunk1.semantic_break_reason} + {chunk2.semantic_break_reason}",
            word_count=len(merged_text.split()),
            char_count=len(merged_text)
        )
    
    def _split_large_chunk(self, chunk: TextChunk) -> List[TextChunk]:
        """Divide chunk muito grande"""
        sub_chunks = []
        text = chunk.text
        
        # Dividir por sentenças primeiro
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        current_text = ""
        current_start = chunk.start_position
        
        for sentence in sentences:
            test_text = current_text + " " + sentence if current_text else sentence
            
            if len(test_text) > self.settings.MAX_CHUNK_SIZE and current_text:
                # Criar sub-chunk
                sub_chunk = TextChunk(
                    id=len(sub_chunks),
                    text=current_text.strip(),
                    start_position=current_start,
                    end_position=current_start + len(current_text),
                    semantic_break_reason=f"split_from_{chunk.id}",
                    word_count=len(current_text.split()),
                    char_count=len(current_text)
                )
                sub_chunks.append(sub_chunk)
                
                current_text = sentence
                current_start += len(current_text)
            else:
                current_text = test_text
        
        # Adicionar último sub-chunk
        if current_text.strip():
            sub_chunk = TextChunk(
                id=len(sub_chunks),
                text=current_text.strip(),
                start_position=current_start,
                end_position=chunk.end_position,
                semantic_break_reason=f"split_from_{chunk.id}",
                word_count=len(current_text.split()),
                char_count=len(current_text)
            )
            sub_chunks.append(sub_chunk)
        
        return sub_chunks