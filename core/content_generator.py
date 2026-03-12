"""
GERADOR DE CONTEÚDO COM CHATGPT-4O-MINI
Responsável por gerar conteúdo usando OpenAI API
"""

import openai
from typing import Dict, List
from datetime import datetime
import time
import json

from utils.logger import SystemLogger
from config.prompts import SystemPrompts
from config.settings import Settings
from core.chunking_engine import TextChunk

class ContentGenerator:
    """Gerador de conteúdo baseado em ChatGPT-4o-mini"""
    
    def __init__(self, logger: SystemLogger):
        self.logger = logger
        self.prompts = SystemPrompts()
        self.settings = Settings()
        
        # Configurar OpenAI
        self.setup_openai()
    
    def setup_openai(self):
        """Configura cliente OpenAI"""
        try:
            # Validar API Key
            is_valid, message = self.settings.validate_api_key()
            if not is_valid:
                self.logger.error(f"❌ {message}")
                raise ValueError(message)
            
            # Configurar cliente (com base_url opcional para gateway/proxy compatível)
            client_kwargs = {"api_key": self.settings.OPENAI_API_KEY}
            if self.settings.OPENAI_BASE_URL:
                client_kwargs["base_url"] = self.settings.OPENAI_BASE_URL
            self.client = openai.OpenAI(**client_kwargs)
            
            self.logger.info("✅ Cliente OpenAI configurado")
            
        except Exception as e:
            self.logger.error(f"Erro ao configurar OpenAI: {e}")
            raise
    
    def generate_all_documents(self, chunks: List[TextChunk], 
                             processo_name: str, departamento: str, 
                             subarea: str) -> Dict[str, str]:
        """
        Gera conteúdo para todos os três documentos usando ChatGPT
        """
        self.logger.info(f"🎯 Gerando conteúdo com ChatGPT para: {processo_name}")
        
        # Combinar chunks em texto único
        texto_completo = self._combine_chunks_for_analysis(chunks)
        
        # Verificar tamanho do texto
        if len(texto_completo) > 10000:  # Limite para GPT-4o-mini
            self.logger.warning("⚠️ Texto muito longo, truncando para análise")
            texto_completo = texto_completo[:10000] + "\n\n[TEXTO TRUNCADO]"
        
        documents = {}
        
        try:
            # 1. Ficha Técnica
            self.logger.info("📋 Gerando Ficha Técnica com ChatGPT...")
            documents['ficha_tecnica'] = self._generate_with_chatgpt(
                "ficha_tecnica", texto_completo, departamento, subarea
            )
            
            # Pausa entre chamadas
            time.sleep(self.settings.OPENAI_CALL_INTERVAL_SEC)
            
            # 2. Fluxograma Mermaid
            self.logger.info("🔄 Gerando Fluxograma com ChatGPT...")
            documents['fluxograma'] = self._generate_with_chatgpt(
                "fluxograma", texto_completo, departamento, subarea
            )
            
            # Pausa entre chamadas
            time.sleep(self.settings.OPENAI_CALL_INTERVAL_SEC)
            
            # 3. Riscos e Automação
            self.logger.info("⚠️ Gerando Análise de Riscos com ChatGPT...")
            documents['riscos'] = self._generate_with_chatgpt(
                "riscos", texto_completo, departamento, subarea
            )
            
            self.logger.info("✅ Geração com ChatGPT concluída")
            return documents
            
        except Exception as e:
            self.logger.error(f"Erro na geração com ChatGPT: {e}")
            return self._get_fallback_documents(processo_name, departamento, subarea)
    
    def _generate_with_chatgpt(self, doc_type: str, texto: str, 
                              departamento: str, subarea: str) -> str:
        """Gera documento específico usando ChatGPT"""
        try:
            # Obter prompt formatado
            prompt = self.prompts.get_prompt(doc_type, texto, departamento, subarea)
            
            self.logger.debug(f"Enviando prompt para ChatGPT ({doc_type})")
            
            # Fazer chamada para API
            response = self._chat_completion_with_retry(
                model=self.settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system", 
                        "content": self.prompts.SYSTEM_MESSAGE
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                max_tokens=self.settings.OPENAI_MAX_TOKENS,
                temperature=self.settings.OPENAI_TEMPERATURE,
                timeout=self.settings.OPENAI_TIMEOUT
            )
            
            # Extrair conteúdo da resposta
            content = response.choices[0].message.content.strip()
            
            # Log de sucesso
            self.logger.info(f"✅ {doc_type} gerado: {len(content)} caracteres")
            
            # Validar conteúdo mínimo
            if len(content) < 100:
                self.logger.warning(f"⚠️ Conteúdo muito curto para {doc_type}")
                return self._get_error_template(doc_type, "Resposta muito curta do ChatGPT")
            
            return content
            
        except openai.RateLimitError as e:
            self.logger.error(f"❌ Rate limit excedido: {e}")
            return self._get_error_template(
                doc_type,
                "Rate limit/cota da API excedido. Aguarde alguns minutos e tente novamente."
            )
            
        except openai.AuthenticationError as e:
            self.logger.error(f"❌ Erro de autenticação: {e}")
            return self._get_error_template(doc_type, "API Key inválida")
            
        except openai.APITimeoutError as e:
            self.logger.error(f"❌ Timeout da API: {e}")
            return self._get_error_template(doc_type, "Timeout na chamada da API")
            
        except Exception as e:
            self.logger.error(f"❌ Erro na geração {doc_type}: {e}")
            return self._get_error_template(doc_type, str(e))
    
    def _chat_completion_with_retry(self, **kwargs):
        """Executa chat completion com retry para erros transientes."""
        max_attempts = max(1, int(self.settings.OPENAI_RETRY_MAX_ATTEMPTS))
        base_wait = max(0.5, float(self.settings.OPENAI_RETRY_BASE_SECONDS))

        for attempt in range(1, max_attempts + 1):
            try:
                return self.client.chat.completions.create(**kwargs)
            except (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError) as e:
                if attempt >= max_attempts:
                    raise
                wait_seconds = base_wait * (2 ** (attempt - 1))
                self.logger.warning(
                    f"Tentativa {attempt}/{max_attempts} falhou ({type(e).__name__}). "
                    f"Nova tentativa em {wait_seconds:.1f}s."
                )
                time.sleep(wait_seconds)

    def _combine_chunks_for_analysis(self, chunks: List[TextChunk]) -> str:
        """Combina chunks para análise"""
        if not chunks:
            return ""
        
        # Combinar chunks mantendo contexto
        combined_text = []
        
        for chunk in chunks:
            combined_text.append(chunk.text)
        
        return "\n\n".join(combined_text)
    
    def _get_fallback_documents(self, processo: str, departamento: str, 
                               subarea: str) -> Dict[str, str]:
        """Retorna documentos de fallback em caso de erro"""
        self.logger.warning("⚠️ Usando documentos de fallback")
        
        return {
            'ficha_tecnica': self._get_error_template("ficha_tecnica", "Falha na API do ChatGPT"),
            'fluxograma': self._get_error_template("fluxograma", "Falha na API do ChatGPT"),
            'riscos': self._get_error_template("riscos", "Falha na API do ChatGPT")
        }
    
    def _get_error_template(self, doc_type: str, error_msg: str) -> str:
        """Retorna template de erro"""
        return f"""# ERRO NA GERAÇÃO DO DOCUMENTO

**Tipo:** {doc_type}
**Erro:** {error_msg}
**Data:** {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}

Este documento não pôde ser gerado automaticamente devido a um erro na API do ChatGPT.

## AÇÕES NECESSÁRIAS:
1. Verificar configuração da API Key
2. Verificar conectividade com internet
3. Verificar limites de uso da API OpenAI
4. Tentar novamente ou gerar conteúdo manualmente

---
**SISTEMA:** Análise e Geração Documental v1.0
"""
    
    def test_api_connection(self) -> tuple[bool, str]:
        """Testa conexão com API do ChatGPT"""
        try:
            self.logger.info("🔍 Testando conexão com ChatGPT...")
            
            response = self._chat_completion_with_retry(
                model=self.settings.OPENAI_MODEL,
                messages=[
                    {"role": "user", "content": "Responda apenas: 'Conexão OK'"}
                ],
                max_tokens=10,
                temperature=0
            )
            
            result = response.choices[0].message.content.strip()
            
            if "OK" in result:
                self.logger.info("✅ Conexão com ChatGPT estabelecida")
                return True, "Conexão estabelecida com sucesso"
            else:
                return False, f"Resposta inesperada: {result}"
                
        except Exception as e:
            self.logger.error(f"❌ Falha na conexão: {e}")
            return False, str(e)
