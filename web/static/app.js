const api = window.hpoApi || (async function fallbackApi(path, options = {}) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const baseHeaders = { "Content-Type": "application/json", "X-CSRF-Token": csrfToken };
  const response = await fetch(path, { headers: { ...baseHeaders, ...(options.headers || {}) }, ...options });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  let payload = null;
  let rawText = "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    rawText = await response.text();
  }
  if (!response.ok) {
    const msg = (payload && payload.message) || rawText || `Erro HTTP ${response.status}`;
    throw new Error(msg);
  }
  return payload || {};
});

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const PDF_HEADER_RGB = [0, 3, 77];
const PDF_TITLE_RGB = [0, 3, 77];
const MULTI_FILTER_IDS = new Set([
  "proc-flt-departamento",
  "proc-flt-status",
  "proc-dash-filter-dept",
  "proc-dash-filter-resp",
  "proc-dash-filter-status",
  "flt-status",
  "dash-filter-status",
  "dash-filter-criticidade",
  "dash-filter-setor",
  "dash-filter-responsavel",
  "usr-filter-login",
]);
const SEARCHABLE_SELECT_CONFIGS = {
  "proj-responsavel": {
    multiple: false,
    placeholder: "Selecione um responsável",
    searchPlaceholder: "Buscar usuário...",
    emptyText: "Nenhum usuário encontrado.",
  },
  "edit-proj-responsavel": {
    multiple: false,
    placeholder: "Selecione um responsável",
    searchPlaceholder: "Buscar usuário...",
    emptyText: "Nenhum usuário encontrado.",
  },
  "proj-focal": {
    multiple: false,
    placeholder: "Selecione um focal",
    searchPlaceholder: "Buscar usuário...",
    emptyText: "Nenhum usuário encontrado.",
  },
  "edit-proj-focal": {
    multiple: false,
    placeholder: "Selecione um focal",
    searchPlaceholder: "Buscar usuário...",
    emptyText: "Nenhum usuário encontrado.",
  },
  "proj-participantes": {
    multiple: true,
    placeholder: "Selecione participantes",
    searchPlaceholder: "Buscar participantes...",
    emptyText: "Nenhum participante encontrado.",
    showSelectedItems: true,
  },
  "edit-proj-participantes": {
    multiple: true,
    placeholder: "Selecione participantes",
    searchPlaceholder: "Buscar participantes...",
    emptyText: "Nenhum participante encontrado.",
    showSelectedItems: true,
  },
  "dash-filter-etapa-responsavel": {
    multiple: false,
    placeholder: "Todos",
    searchPlaceholder: "Buscar responsável da etapa...",
    emptyText: "Nenhum responsável encontrado.",
  },
};

function drawPdfHeader(doc, { title, subtitle, margin, y, pageW }) {
  const headerHeight = 64;
  const brandWidth = 110;
  const brandHeight = 34;
  const brandX = pageW - margin - brandWidth - 14;
  const brandY = y + 15;

  doc.setFillColor(...PDF_HEADER_RGB);
  doc.roundedRect(margin, y, pageW - margin * 2, headerHeight, 8, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin + 14, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, margin + 14, y + 44);

  // Fallback textual brand aligned to the right while no binary logo asset is bundled in the project.
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(brandX, brandY, brandWidth, brandHeight, 10, 10, "F");
  doc.setTextColor(...PDF_HEADER_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SANCHEZ LAB", brandX + brandWidth / 2, brandY + 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("TECNOLOGIA", brandX + brandWidth / 2, brandY + 25, { align: "center" });
}

function maskSecret(secret) {
  const raw = String(secret || "");
  if (!raw) return "";
  if (raw.length <= 4) return "****";
  return `${raw.slice(0, 2)}${"*".repeat(Math.max(4, raw.length - 4))}${raw.slice(-2)}`;
}

function formatCurrencyBRL(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "R$ -";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseCurrencyBRL(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const normalized = text
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrencyInputValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const numeric = typeof value === "number" ? value : parseCurrencyBRL(text);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function bindCurrencyInput(inputId) {
  const input = $(inputId);
  if (!input) return;
  input.addEventListener("blur", () => {
    input.value = formatCurrencyInputValue(input.value);
  });
}

function fixMojibakeText(value) {
  const text = String(value || "");
  if (!text) return "";
  const map = {
    "Ã¡": "á", "Ã¢": "â", "Ã£": "ã", "Ã¤": "ä",
    "Ã©": "é", "Ãª": "ê",
    "Ã­": "í",
    "Ã³": "ó", "Ã´": "ô", "Ãµ": "õ",
    "Ãº": "ú",
    "Ã§": "ç",
    "Ã": "Á", "Ã‰": "É", "Ã": "Í", "Ã“": "Ó", "Ãš": "Ú", "Ã‡": "Ç",
    "â€œ": "\"", "â€": "\"", "â€˜": "'", "â€™": "'",
    "Âº": "º", "Âª": "ª",
  };
  let out = text;
  Object.entries(map).forEach(([bad, good]) => {
    out = out.split(bad).join(good);
  });
  return out;
}

function showTemporaryPassword(containerId, password, expiresAt = "") {
  const container = $(containerId);
  if (!container) return;
  const masked = maskSecret(password);
  const exp = expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "";
  container.style.color = "green";
  container.innerHTML = `
    Senha temporária gerada: <strong>${masked}</strong>
    ${exp ? `<span style="margin-left:8px;">(expira em ${exp})</span>` : ""}
    <button id="btn-copy-temp-password" class="btn ghost btn-sm" style="margin-left:8px;">Copiar</button>
  `;
  const btn = $("btn-copy-temp-password");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(String(password || ""));
        btn.textContent = "Copiado";
      } catch {
        btn.textContent = "Falha ao copiar";
      }
    }, { once: true });
  }
}

async function withButtonBusy(button, task, busyText = "Processando...") {
  if (!button) return task();
  if (button.disabled) return null;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function appendAiMessage(text, role = "bot") {
  const body = $("ai-chat-body");
  if (!body) return;
  const item = document.createElement("article");
  item.className = `ai-msg ${role === "user" ? "ai-msg-user" : "ai-msg-bot"}`;
  item.textContent = String(text || "");
  body.appendChild(item);
  body.scrollTop = body.scrollHeight;
}

function ensureAiGreeting() {
  if (aiChatInitialized) return;
  aiChatInitialized = true;
  appendAiMessage(
    "Olá! Eu sou a Justine, assistente do HPO. Posso te ajudar com dados de projetos e processos conforme seu perfil de acesso.",
    "bot",
  );
}

function toggleAiChat(open) {
  const widget = $("ai-chat-widget");
  if (!widget) return;
  const shouldOpen = typeof open === "boolean" ? open : widget.classList.contains("hidden");
  widget.classList.toggle("hidden", !shouldOpen);
  if (shouldOpen) {
    ensureAiGreeting();
    $("ai-chat-input")?.focus();
  }
}

async function sendAiChatMessage() {
  if (aiChatSending) return;
  const input = $("ai-chat-input");
  const btn = $("ai-chat-send");
  if (!input || !btn) return;
  const message = String(input.value || "").trim();
  if (!message) return;

  aiChatSending = true;
  input.value = "";
  appendAiMessage(message, "user");
  btn.disabled = true;
  btn.textContent = "Enviando...";
  try {
    const data = await api("/api/assistant/chat", { method: "POST", body: JSON.stringify({ message }) });
    appendAiMessage(data.answer || "Não consegui responder agora.", "bot");
  } catch (error) {
    appendAiMessage(error.message || "Falha ao consultar a Justine.", "bot");
  } finally {
    aiChatSending = false;
    btn.disabled = false;
    btn.textContent = "Enviar";
    input.focus();
  }
}

let currentPreview = null;
let configDirty = false;
let lastPriorizacaoInput = null;
let dashboardProjects = [];
let projectViewMode = "lista";
const ganttExpandedProjects = new Set();
const dashboardSummaryExpandedProjects = new Set();
const dashboardCharts = {};
const procDashboardCharts = {};
let currentUser = null;
let currentPermissions = [];
let departamentosCache = [];
let cargosCache = [];
let usuariosCache = [];
let processosCache = [];
let editingProcessId = "";
let lastPriorizacaoResult = null;
const processoDeptExpanded = new Set();
const processoItemExpanded = new Set();
const processoItemStagesCollapsed = new Set();
let processConsultaViewMode = "list";
let aiChatInitialized = false;
let aiChatSending = false;
let editingUserId = "";
let editingRoleId = "";
const PROCESS_SCRIPT_STORAGE_KEY = "hpo_process_voice_script_v1";
const MENU_GROUPS_STORAGE_KEY = "hpo_menu_groups_state_v1";
const PROCESS_SCRIPT_PROFILES_KEY = "hpo_process_voice_script_profiles_v1";
const DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES = [
  {
    id: "bloco_1_identificacao_processo",
    nome: "BLOCO 1 - IDENTIFICAÇÃO DO PROCESSO",
    perguntas: [
      { pergunta: "Nome do processo", exemplo: "[Extrair do conteúdo ou inferir a partir da atividade descrita]" },
      { pergunta: "Área responsável ou departamento", exemplo: "[Registrar o departamento responsável pelo processo]" },
      { pergunta: "Subárea ou célula operacional", exemplo: "[Registrar a subárea operacional responsável]" },
      { pergunta: "Nome do apresentador do processo", exemplo: "[Registrar quem está apresentando ou descrevendo o processo]" },
      { pergunta: "Cargo do apresentador", exemplo: "[Registrar o cargo ou função do apresentador]" },
      { pergunta: "Cargo de quem executa o processo no dia a dia", exemplo: "[Registrar o cargo responsável pela execução operacional]" },
      { pergunta: "Dono do processo", exemplo: "[Responsável final pelo desempenho, resultados e governança do processo]" },
      { pergunta: "Problema de negócio que este processo existe para resolver", exemplo: "[Descrever o problema ou necessidade de negócio atendida pelo processo]" },
    ],
  },
  {
    id: "bloco_2_volumetria_frequencia",
    nome: "BLOCO 2 - VOLUMETRIA E FREQUÊNCIA",
    perguntas: [
      { pergunta: "Frequência do processo por dia", exemplo: "[Quantas vezes o processo ocorre em média por dia]" },
      { pergunta: "Frequência do processo por mês", exemplo: "[Quantas vezes o processo ocorre em média por mês]" },
      { pergunta: "Tempo médio de execução do processo", exemplo: "[Tempo médio necessário para concluir uma execução do processo]" },
      { pergunta: "Tempo mínimo observado", exemplo: "[Menor tempo já observado para execução do processo]" },
      { pergunta: "Tempo máximo observado", exemplo: "[Maior tempo já observado para execução do processo]" },
      { pergunta: "Quantidade média de itens processados por ciclo", exemplo: "[Volume médio de itens, registros ou demandas tratadas em cada execução do processo]" },
      { pergunta: "Capacidade de escalabilidade do processo", exemplo: "[Indicar se o processo continuaria funcionando caso o volume dobrasse]" },
      { pergunta: "Existência de picos sazonais de demanda", exemplo: "[Indicar se existem períodos específicos com aumento significativo de volume]" },
    ],
  },
  {
    id: "bloco_3_gatilho_entradas",
    nome: "BLOCO 3 - GATILHO E ENTRADAS DO PROCESSO",
    perguntas: [
      { pergunta: "Gatilho de início do processo", exemplo: "[Evento, demanda, solicitação ou condição que inicia o processo]" },
      { pergunta: "Responsável ou sistema que dispara o processo", exemplo: "[Pessoa, área ou sistema que inicia o fluxo]" },
      { pergunta: "Dependência de aprovação prévia", exemplo: "[Indicar se o processo exige alguma aprovação antes de iniciar]" },
      { pergunta: "Informações necessárias para iniciar o processo", exemplo: "[Dados ou informações mínimas necessárias para dar início ao fluxo]" },
      { pergunta: "Dados de entrada obrigatórios", exemplo: "[Campos ou dados que devem obrigatoriamente estar presentes para iniciar o processo]" },
      { pergunta: "Documentos de suporte exigidos", exemplo: "[Arquivos, formulários ou evidências necessárias para iniciar o processo]" },
      { pergunta: "Autorizações necessárias", exemplo: "[Permissões ou aprovações formais exigidas para início ou continuidade do processo]" },
      { pergunta: "Condição inicial das informações recebidas", exemplo: "[Indicar se o processo geralmente inicia com todas as informações completas ou com ausência de dados]" },
    ],
  },
  {
    id: "bloco_4_sistemas_tecnologia",
    nome: "BLOCO 4 - SISTEMAS E TECNOLOGIA",
    perguntas: [
      { pergunta: "Sistemas utilizados no processo", exemplo: "[Listar todos os sistemas, plataformas ou ferramentas utilizadas]" },
      { pergunta: "Sistemas obrigatórios", exemplo: "[Sistemas indispensáveis para execução do processo]" },
      { pergunta: "Sistemas de apoio", exemplo: "[Sistemas utilizados apenas como suporte ou consulta]" },
      { pergunta: "Integrações entre sistemas", exemplo: "[Indicar se existe integração automática entre sistemas e quais sistemas estão integrados]" },
      { pergunta: "Retrabalho por digitação manual duplicada", exemplo: "[Indicar se informações precisam ser digitadas manualmente mais de uma vez]" },
      { pergunta: "Quantidade de reinserções da mesma informação", exemplo: "[Quantas vezes a mesma informação precisa ser registrada novamente em diferentes sistemas ou etapas]" },
      { pergunta: "Controles paralelos", exemplo: "[Indicar se existem controles fora dos sistemas principais como planilhas, arquivos locais, documentos ou e-mails]" },
    ],
  },
  {
    id: "bloco_5_pontos_decisao",
    nome: "BLOCO 5 - PONTOS DE DECISÃO",
    perguntas: [
      { pergunta: "Existência de decisões humanas no processo", exemplo: "[Indicar se existem etapas onde decisões humanas são necessárias]" },
      { pergunta: "Responsável pelas decisões", exemplo: "[Indicar quem toma as decisões dentro do processo]" },
      { pergunta: "Critérios utilizados para decisão", exemplo: "[Descrever os critérios, regras ou parâmetros utilizados para tomada de decisão]" },
      { pergunta: "Existência de política ou regra formal", exemplo: "[Indicar se as decisões seguem políticas, normas ou regras documentadas ou se são baseadas em julgamento subjetivo]" },
      { pergunta: "Consistência das decisões", exemplo: "[Indicar se duas pessoas diferentes tenderiam a tomar a mesma decisão nas mesmas condições]" },
      { pergunta: "Possibilidade de automação das decisões", exemplo: "[Indicar se alguma decisão poderia ser automatizada com base em regras, dados ou sistemas]" },
    ],
  },
  {
    id: "bloco_6_regras_excecoes",
    nome: "BLOCO 6 - REGRAS E EXCEÇÕES",
    perguntas: [
      { pergunta: "Regras obrigatórias do processo", exemplo: "[Listar as regras que devem ser obrigatoriamente seguidas durante a execução do processo]" },
      { pergunta: "Limites financeiros aplicáveis", exemplo: "[Indicar valores ou limites financeiros que impactam decisões ou aprovações no processo]" },
      { pergunta: "Aprovações necessárias", exemplo: "[Indicar quais aprovações são exigidas ao longo do processo]" },
      { pergunta: "Documentos obrigatórios", exemplo: "[Listar documentos que devem obrigatoriamente ser apresentados ou registrados]" },
      { pergunta: "Exceções mais frequentes", exemplo: "[Descrever situações fora do fluxo padrão que ocorrem com maior frequência]" },
      { pergunta: "Foco do desenho do processo", exemplo: "[Indicar se o processo foi desenhado principalmente para o fluxo padrão ou para tratar exceções]" },
      { pergunta: "Tratamento das exceções", exemplo: "[Descrever como as exceções são tratadas quando ocorrem]" },
    ],
  },
  {
    id: "bloco_7_gargalos_operacionais",
    nome: "BLOCO 7 - GARGALOS OPERACIONAIS",
    perguntas: [
      { pergunta: "Maior gargalo atual do processo", exemplo: "[Identificar qual etapa ou condição representa o principal ponto de lentidão ou limitação do processo]" },
      { pergunta: "Gargalo relacionado a tempo de espera", exemplo: "[Indicar se existem filas ou períodos de espera que impactam o fluxo]" },
      { pergunta: "Gargalo relacionado à dependência de pessoa", exemplo: "[Indicar se o processo depende fortemente de uma pessoa específica]" },
      { pergunta: "Gargalo relacionado à dependência de outra área", exemplo: "[Indicar se o processo depende de atividades ou respostas de outra área]" },
      { pergunta: "Gargalo relacionado à lentidão de sistema", exemplo: "[Indicar se sistemas utilizados causam atrasos ou baixa performance]" },
      { pergunta: "Gargalo relacionado à falta de informações", exemplo: "[Indicar se o processo frequentemente sofre atrasos por ausência ou inconsistência de dados]" },
      { pergunta: "Etapa que poderia ser removida", exemplo: "[Indicar qual etapa poderia ser eliminada sem comprometer o resultado do processo]" },
      { pergunta: "Risco de paralisação por ausência de pessoa-chave", exemplo: "[Indicar se o processo pode parar ou sofrer forte impacto caso uma pessoa específica se ausente]" },
    ],
  },
  {
    id: "bloco_8_riscos_processo",
    nome: "BLOCO 8 - RISCOS DO PROCESSO",
    perguntas: [
      { pergunta: "Riscos potenciais do processo", exemplo: "[Descrever o que pode dar errado durante a execução do processo]" },
      { pergunta: "Risco de erros humanos", exemplo: "[Indicar se o processo está sujeito a falhas operacionais por intervenção humana]" },
      { pergunta: "Risco de dados incorretos", exemplo: "[Indicar se existe possibilidade de utilização de dados incorretos ou inconsistentes]" },
      { pergunta: "Risco de fraude", exemplo: "[Indicar se existem vulnerabilidades que possam permitir fraude]" },
      { pergunta: "Risco de atraso no processo", exemplo: "[Indicar se existem fatores que possam causar atrasos na execução]" },
      { pergunta: "Risco de não conformidade regulatória", exemplo: "[Indicar se existe risco de descumprimento de normas, políticas ou regulamentações]" },
      { pergunta: "Impacto financeiro em caso de falha", exemplo: "[Descrever possíveis perdas ou impactos financeiros]" },
      { pergunta: "Impacto operacional em caso de falha", exemplo: "[Descrever impactos na operação ou continuidade do processo]" },
      { pergunta: "Impacto regulatório em caso de falha", exemplo: "[Descrever possíveis consequências regulatórias ou legais]" },
      { pergunta: "Impacto reputacional em caso de falha", exemplo: "[Descrever possíveis impactos na imagem ou reputação da organização]" },
      { pergunta: "Existência de controles preventivos", exemplo: "[Indicar se existem controles, verificações ou mecanismos para evitar falhas]" },
      { pergunta: "Dependência de conhecimento não documentado", exemplo: "[Indicar se o processo depende de conhecimento tácito ou não formalizado]" },
    ],
  },
  {
    id: "bloco_9_resultado_final",
    nome: "BLOCO 9 - RESULTADO FINAL",
    perguntas: [
      { pergunta: "Resultado final do processo", exemplo: "[Descrever qual produto, entrega, registro ou resultado é gerado ao final do processo]" },
      { pergunta: "Usuários do resultado do processo", exemplo: "[Indicar quem utiliza ou recebe o resultado gerado]" },
      { pergunta: "Utilização efetiva do resultado", exemplo: "[Indicar se o resultado é realmente utilizado ou apenas armazenado ou arquivado]" },
      { pergunta: "Adequação do formato do resultado", exemplo: "[Indicar se o formato atual da entrega atende às necessidades de quem utiliza o resultado]" },
    ],
  },
  {
    id: "bloco_10_indicadores",
    nome: "BLOCO 10 - INDICADORES",
    perguntas: [
      { pergunta: "Existência de indicadores do processo", exemplo: "[Indicar se existem métricas ou indicadores utilizados para monitorar o processo]" },
      { pergunta: "Indicador de tempo médio", exemplo: "[Indicar se existe medição do tempo médio de execução do processo]" },
      { pergunta: "Indicador de taxa de erro", exemplo: "[Indicar se existe medição da quantidade ou percentual de erros]" },
      { pergunta: "Indicador de retrabalho", exemplo: "[Indicar se existe medição de atividades refeitas ou corrigidas]" },
      { pergunta: "Indicador de custo do processo", exemplo: "[Indicar se existe medição de custos associados à execução do processo]" },
      { pergunta: "Indicador de produtividade", exemplo: "[Indicar se existe medição de volume produzido ou eficiência operacional]" },
      { pergunta: "Forma atual de identificação de falhas no processo", exemplo: "[Descrever como a organização percebe ou identifica quando o processo está falhando]" },
      { pergunta: "Confiabilidade e atualização dos indicadores", exemplo: "[Indicar se os indicadores são confiáveis e se são atualizados automaticamente ou manualmente]" },
      { pergunta: "Métricas desejadas ainda inexistentes", exemplo: "[Indicar quais indicadores ou métricas deveriam existir, mas ainda não foram implementados]" },
    ],
  },
  {
    id: "bloco_11_oportunidades_melhoria",
    nome: "BLOCO 11 - OPORTUNIDADES DE MELHORIA",
    perguntas: [
      { pergunta: "Principal fator que mais atrasa o processo", exemplo: "[Identificar a atividade, condição ou etapa que mais contribui para atrasos]" },
      { pergunta: "Principal fator que gera retrabalho", exemplo: "[Identificar a atividade ou condição que mais gera repetição de tarefas]" },
      { pergunta: "Principal fator que gera erros", exemplo: "[Identificar a atividade ou condição que apresenta maior incidência de falhas]" },
      { pergunta: "Oportunidades de automação", exemplo: "[Indicar atividades ou etapas que poderiam ser automatizadas]" },
      { pergunta: "Etapa que poderia ser eliminada", exemplo: "[Indicar qual etapa poderia ser removida sem comprometer o resultado do processo]" },
      { pergunta: "Melhorias de baixo esforço e alto impacto", exemplo: "[Indicar melhorias simples que poderiam gerar ganhos relevantes de eficiência ou qualidade]" },
    ],
  },
  {
    id: "bloco_12_fluxo_processo",
    nome: "BLOCO 12 - FLUXO DO PROCESSO",
    perguntas: [
      { pergunta: "Descrição do fluxo completo do processo", exemplo: "[Descrever o processo desde o gatilho inicial até o resultado final]" },
      { pergunta: "Etapas do processo", exemplo: "[Listar todas as etapas identificadas no fluxo]" },
      { pergunta: "Responsável por cada etapa", exemplo: "[Indicar quem executa cada etapa do processo]" },
      { pergunta: "Sistema utilizado em cada etapa", exemplo: "[Indicar qual sistema, ferramenta ou plataforma é utilizada em cada etapa, quando aplicável]" },
      { pergunta: "Tempo de execução por etapa", exemplo: "[Registrar o tempo médio necessário para execução de cada etapa]" },
      { pergunta: "Etapa que mais consome tempo", exemplo: "[Identificar qual etapa apresenta maior tempo de execução]" },
      { pergunta: "Etapa que mais gera erros", exemplo: "[Identificar qual etapa apresenta maior incidência de erros ou retrabalho]" },
      { pergunta: "Aderência entre fluxo real e fluxo documentado", exemplo: "[Indicar se o fluxo executado na prática é igual ao fluxo oficial ou documentado]" },
    ],
  },
];
const PROCESS_SCRIPT_FALLBACK_GROUP = { id: "outros_assuntos", nome: "Outros Assuntos" };
const DEFAULT_PROCESS_SCRIPT_QUESTIONS = DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES.flatMap((group) => group.perguntas);

const DEFAULT_PROCESS_SCRIPT_PROFILES = [
  { id: "geral", nome: "Geral", grupos: DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES },
  { id: "financeiro", nome: "Financeiro", grupos: DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES },
  { id: "rh", nome: "Recursos Humanos", grupos: DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES },
  { id: "ti", nome: "Tecnologia da Informação", grupos: DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES },
  { id: "operacoes", nome: "Operações", grupos: DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES },
];

const STATUS_LABELS = {
  ja_existe: "Arquivo já existente",
  pendente: "Pendente",
  gerando: "Gerando documentos",
  aguardando_aprovacao: "Aguardando Aprovação",
  processado: "Processado",
  erro_leitura: "Erro de leitura",
  erro_geracao: "Erro de geração",
  em_andamento: "Em andamento",
  proxima_sprint: "Próxima Sprint",
  concluido: "Concluído",
  concluida: "Concluída",
  backlog: "Backlog",
  cancelado: "Cancelado",
  atrasado: "Atrasado",
};
const PROJECT_COLORS = ["#4f46e5", "#0ea5a4", "#f59e0b", "#10b981", "#ef4444", "#2563eb", "#84cc16"];
const GANTT_STATUS_COLORS = {
  em_andamento: "#f59e0b",
  atrasado: "#ef4444",
  pausado: "#3b82f6",
  concluido: "#10b981",
  backlog: "#64748b",
  proxima_sprint: "#8b5cf6",
  cancelado: "#6b7280",
};
const GANTT_STATUS_ORDER = ["em_andamento", "atrasado", "pausado", "concluido", "backlog", "proxima_sprint", "cancelado"];
const ICON_CHEVRON_DOWN = "\u25BE";
const ICON_CHEVRON_RIGHT = "\u25B8";
const ICON_BULLET = "\u2022";
const ICON_ARROW_RIGHT = "\u2192";
const ICON_EDIT = "\u270E";
const ICON_TRASH = "\u{1F5D1}";
const ICON_ELLIPSIS = "\u22EF";

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusLabel(value) {
  if (!value) return "Não informado";
  return STATUS_LABELS[value] || String(value).replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeProjectStatus(status) {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "concluida") return "concluido";
  return raw || "em_andamento";
}

function getGanttProjectVisual(project, ini, fim) {
  const now = new Date();
  let statusKey = normalizeProjectStatus(project?.status);
  const isOverdue = fim && fim < now && statusKey !== "concluido" && !project?.termino_real;
  if (isOverdue) statusKey = "atrasado";
  return {
    statusKey,
    color: GANTT_STATUS_COLORS[statusKey] || "#64748b",
    label: statusLabel(statusKey),
  };
}

function getGanttStageVisual(stage, ini, fim) {
  const now = new Date();
  let statusKey = normalizeProjectStatus(stage?.status);
  const isOverdue = fim && fim < now && statusKey !== "concluido" && !stage?.fim_real;
  if (isOverdue) statusKey = "atrasado";
  return {
    statusKey,
    color: GANTT_STATUS_COLORS[statusKey] || "#5b8de6",
    label: statusLabel(statusKey),
  };
}

const VIEW_LABELS = {
  "view-processos-analise": "Análise de Processos",
  "view-processos-priorizacao": "Robozômetro",
  "view-processos-cadastro": "Cadastro de Processos",
  "view-processos-consulta": "Consultar Processos",
  "view-processos-dashboard": "Dashboard de Processos",
  "view-projetos-cadastrar": "Cadastrar Projetos",
  "view-projetos-consultar": "Consultar Projetos",
  "view-projetos-dashboard": "Dashboard de Projetos",
  "view-projetos-setores": "Cadastro de Setores",
  "view-cadastros-script-perguntas": "Script de Perguntas",
  "view-cadastros-cargos": "Cadastro de Cargos",
  "view-cadastros-usuarios": "Cadastro de Usuários",
  "view-cadastros-perfis": "Papéis e Acessos",
};

function viewLabel(viewId) {
  return VIEW_LABELS[viewId] || viewId;
}

function getSelectNonEmptyOptions(select) {
  return Array.from(select?.options || []).filter((o) => String(o.value || "").trim() !== "");
}

function getMultiFilterValues(selectId) {
  const select = $(selectId);
  if (!select) return [];
  const options = getSelectNonEmptyOptions(select);
  const selected = options.filter((o) => o.selected).map((o) => String(o.value));
  if (!selected.length || selected.length === options.length) return [];
  return selected;
}

function setMultiFilterValues(selectId, values = []) {
  const select = $(selectId);
  if (!select) return;
  const options = getSelectNonEmptyOptions(select);
  const selectedSet = new Set((values || []).map((v) => String(v)));
  const shouldSelectAll = !selectedSet.size || selectedSet.size >= options.length;
  options.forEach((o) => {
    o.selected = shouldSelectAll ? true : selectedSet.has(String(o.value));
  });
  refreshMultiFilterControl(selectId);
}

function getMultiFilterSummary(selectId) {
  const select = $(selectId);
  if (!select) return "Todos";
  const options = getSelectNonEmptyOptions(select);
  const selected = options.filter((o) => o.selected);
  if (!options.length) return "Sem opções";
  if (!selected.length || selected.length === options.length) return "Todos";
  if (selected.length === 1) return selected[0].textContent || "1 selecionado";
  return `${selected.length} selecionados`;
}

function closeAllMultiFilterMenus(exceptId = "") {
  $$(".multi-filter").forEach((wrap) => {
    if (exceptId && wrap.dataset.selectId === exceptId) return;
    wrap.querySelector(".multi-filter-menu")?.classList.add("hidden");
  });
  $$(".searchable-select").forEach((wrap) => {
    if (exceptId && wrap.dataset.selectId === exceptId) return;
    wrap.querySelector(".searchable-select-menu")?.classList.add("hidden");
  });
}

function refreshMultiFilterControl(selectId) {
  const select = $(selectId);
  if (!select) return;
  const wrap = document.querySelector(`.multi-filter[data-select-id="${selectId}"]`);
  if (!wrap) return;
  const trigger = wrap.querySelector(".multi-filter-trigger");
  if (trigger) trigger.textContent = getMultiFilterSummary(selectId);
  const allCheckbox = wrap.querySelector(".multi-filter-all");
  const options = getSelectNonEmptyOptions(select);
  const selectedCount = options.filter((o) => o.selected).length;
  if (allCheckbox) allCheckbox.checked = !options.length || selectedCount === options.length;
  options.forEach((opt) => {
    const cb = Array.from(wrap.querySelectorAll(".multi-filter-opt")).find((x) => String(x.dataset.value || "") === String(opt.value));
    if (cb) cb.checked = !!opt.selected;
  });
}

function buildMultiFilterControl(selectId) {
  const select = $(selectId);
  if (!select || !MULTI_FILTER_IDS.has(selectId)) return;
  select.multiple = true;

  let wrap = document.querySelector(`.multi-filter[data-select-id="${selectId}"]`);
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "multi-filter";
    wrap.dataset.selectId = selectId;
    wrap.innerHTML = `
      <button type="button" class="multi-filter-trigger btn ghost btn-sm"></button>
      <div class="multi-filter-menu hidden">
        <label class="multi-filter-item">
          <input type="checkbox" class="multi-filter-all">
          <span>Selecionar todas</span>
        </label>
        <div class="multi-filter-divider"></div>
        <div class="multi-filter-options"></div>
      </div>
    `;
    select.insertAdjacentElement("afterend", wrap);
    select.classList.add("hidden");

    wrap.querySelector(".multi-filter-trigger")?.addEventListener("click", () => {
      const menu = wrap.querySelector(".multi-filter-menu");
      const willOpen = menu.classList.contains("hidden");
      closeAllMultiFilterMenus(selectId);
      menu.classList.toggle("hidden", !willOpen);
    });

    wrap.querySelector(".multi-filter-all")?.addEventListener("change", (e) => {
      const options = getSelectNonEmptyOptions(select);
      options.forEach((o) => { o.selected = !!e.target.checked; });
      refreshMultiFilterControl(selectId);
    });
  }

  const optionsWrap = wrap.querySelector(".multi-filter-options");
  const options = getSelectNonEmptyOptions(select);
  optionsWrap.innerHTML = options.map((o) => `
    <label class="multi-filter-item">
      <input type="checkbox" class="multi-filter-opt" data-value="${escapeHtml(String(o.value))}">
      <span>${escapeHtml(o.textContent || o.value)}</span>
    </label>
  `).join("");

  if (!options.some((o) => o.selected)) options.forEach((o) => { o.selected = true; });
  optionsWrap.querySelectorAll(".multi-filter-opt").forEach((cb) => cb.addEventListener("change", () => {
    const value = cb.dataset.value || "";
    const opt = options.find((o) => String(o.value) === value);
    if (!opt) return;
    opt.selected = cb.checked;
    if (!options.some((o) => o.selected)) options.forEach((o) => { o.selected = true; });
    refreshMultiFilterControl(selectId);
  }));
  refreshMultiFilterControl(selectId);
}

function initMultiFilterControls() {
  MULTI_FILTER_IDS.forEach((id) => buildMultiFilterControl(id));
  if (!window.__multiFilterDocBound) {
    document.addEventListener("click", (e) => {
      if (e.target.closest(".multi-filter") || e.target.closest(".searchable-select")) return;
      closeAllMultiFilterMenus();
    });
    window.__multiFilterDocBound = true;
  }
}

function getSelectValues(selectId) {
  const select = $(selectId);
  if (!select) return [];
  return Array.from(select.options || [])
    .filter((opt) => opt.selected && String(opt.value || "").trim() !== "")
    .map((opt) => String(opt.value));
}

function setSelectValues(selectId, values = []) {
  const select = $(selectId);
  if (!select) return;
  const wanted = new Set((values || []).map((value) => String(value)));
  Array.from(select.options || []).forEach((opt) => {
    opt.selected = String(opt.value || "").trim() !== "" && wanted.has(String(opt.value));
  });
}

function getSearchableSelectSummary(selectId) {
  const select = $(selectId);
  const config = SEARCHABLE_SELECT_CONFIGS[selectId];
  if (!select || !config) return "";
  const selected = Array.from(select.options || []).filter((opt) => opt.selected && String(opt.value || "").trim() !== "");
  if (!selected.length) return config.placeholder;
  if (!config.multiple) return selected[0]?.textContent || config.placeholder;
  if (selected.length === 1) return selected[0]?.textContent || "1 participante";
  return `${selected.length} participantes selecionados`;
}

function getSearchableSelectedLabels(selectId) {
  const select = $(selectId);
  if (!select) return [];
  return Array.from(select.options || [])
    .filter((opt) => opt.selected && String(opt.value || "").trim() !== "")
    .map((opt) => String(opt.textContent || "").trim())
    .filter(Boolean);
}

function refreshSearchableSelectControl(selectId, filterText = "") {
  const select = $(selectId);
  const config = SEARCHABLE_SELECT_CONFIGS[selectId];
  const wrap = document.querySelector(`.searchable-select[data-select-id="${selectId}"]`);
  if (!select || !config || !wrap) return;
  const trigger = wrap.querySelector(".searchable-select-trigger");
  if (trigger) trigger.textContent = getSearchableSelectSummary(selectId);
  const selectedWrap = wrap.querySelector(".searchable-select-selected");
  if (selectedWrap) {
    const labels = config.showSelectedItems ? getSearchableSelectedLabels(selectId) : [];
    selectedWrap.innerHTML = labels.length
      ? labels.map((label) => `<span class="searchable-select-chip">${escapeHtml(label)}</span>`).join("")
      : "";
    selectedWrap.classList.toggle("hidden", !labels.length);
  }
  const normalizedFilter = String(filterText || "").trim().toLowerCase();
  const optionsWrap = wrap.querySelector(".searchable-select-options");
  const options = Array.from(select.options || []).filter((opt) => String(opt.value || "").trim() !== "");
  const filtered = options.filter((opt) => String(opt.textContent || "").toLowerCase().includes(normalizedFilter));
  optionsWrap.innerHTML = filtered.length
    ? filtered.map((opt) => `
      <label class="searchable-select-item">
        <input type="${config.multiple ? "checkbox" : "radio"}" class="searchable-select-opt" name="searchable-${selectId}" data-value="${escapeHtml(String(opt.value))}" ${opt.selected ? "checked" : ""}>
        <span>${escapeHtml(opt.textContent || opt.value)}</span>
      </label>
    `).join("")
    : `<div class="searchable-select-empty">${escapeHtml(config.emptyText || "Nenhuma opção encontrada.")}</div>`;

  optionsWrap.querySelectorAll(".searchable-select-opt").forEach((input) => {
    input.addEventListener("change", () => {
      const value = String(input.dataset.value || "");
      if (config.multiple) {
        const next = new Set(getSelectValues(selectId));
        if (input.checked) next.add(value);
        else next.delete(value);
        setSelectValues(selectId, Array.from(next));
      } else {
        setSelectValues(selectId, input.checked ? [value] : []);
        wrap.querySelector(".searchable-select-menu")?.classList.add("hidden");
      }
      refreshSearchableSelectControl(selectId, wrap.querySelector(".searchable-select-search")?.value || "");
    });
  });
}

function buildSearchableSelectControl(selectId) {
  const select = $(selectId);
  const config = SEARCHABLE_SELECT_CONFIGS[selectId];
  if (!select || !config) return;
  select.multiple = !!config.multiple;

  let wrap = document.querySelector(`.searchable-select[data-select-id="${selectId}"]`);
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "searchable-select";
    wrap.dataset.selectId = selectId;
    wrap.innerHTML = `
      <button type="button" class="searchable-select-trigger btn ghost btn-sm"></button>
      <div class="searchable-select-selected hidden"></div>
      <div class="searchable-select-menu hidden">
        <input type="text" class="searchable-select-search" placeholder="${escapeHtml(config.searchPlaceholder || "Buscar...")}">
        <div class="searchable-select-options"></div>
      </div>
    `;
    select.insertAdjacentElement("afterend", wrap);
    select.classList.add("hidden");

    wrap.querySelector(".searchable-select-trigger")?.addEventListener("click", () => {
      const menu = wrap.querySelector(".searchable-select-menu");
      const willOpen = menu.classList.contains("hidden");
      closeAllMultiFilterMenus(selectId);
      menu.classList.toggle("hidden", !willOpen);
      if (willOpen) {
        const searchInput = wrap.querySelector(".searchable-select-search");
        if (searchInput) {
          searchInput.value = "";
          refreshSearchableSelectControl(selectId, "");
          searchInput.focus();
        }
      }
    });

    wrap.querySelector(".searchable-select-search")?.addEventListener("input", (e) => {
      refreshSearchableSelectControl(selectId, e.target.value || "");
    });
  }

  refreshSearchableSelectControl(selectId, wrap.querySelector(".searchable-select-search")?.value || "");
}

function normalizeUserDisplayName(user = {}) {
  return user.nome || user.email || user.username || "Usuário";
}

function getUserNameById(userId = "") {
  const normalizedId = String(userId || "").trim();
  if (!normalizedId) return "";
  const match = (usuariosCache || []).find((user) => String(user.id || "") === normalizedId);
  return match ? normalizeUserDisplayName(match) : "";
}

function createFallbackPersonValue(name = "") {
  const normalizedName = String(name || "").trim();
  return normalizedName ? `__name__:${normalizedName}` : "";
}

function parsePersonSelection(rawValue = "") {
  const value = String(rawValue || "").trim();
  if (!value) return { id: "", name: "" };
  if (value.startsWith("__name__:")) return { id: "", name: value.slice("__name__:".length).trim() };
  return { id: value, name: getUserNameById(value) || "" };
}

function getSelectOptionLabel(selectId, value = "") {
  const select = $(selectId);
  if (!select) return "";
  const option = Array.from(select.options || []).find((opt) => String(opt.value || "") === String(value || ""));
  return String(option?.textContent || "").trim();
}

function findUserIdByName(name = "") {
  const normalizedName = String(name || "").trim().toLowerCase();
  if (!normalizedName) return "";
  const match = (usuariosCache || []).find((user) => normalizeUserDisplayName(user).trim().toLowerCase() === normalizedName);
  return match?.id || "";
}

function cloneQuestions(list = []) {
  return (Array.isArray(list) ? list : []).map((q) => ({
    pergunta: fixMojibakeText(String(q?.pergunta || "")).trim(),
    exemplo: fixMojibakeText(String(q?.exemplo || "")).trim(),
  })).filter((q) => q.pergunta);
}

function slugifyProcessScriptGroupName(value = "") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `grupo_${Date.now()}`;
}

function getDefaultProcessScriptGroups() {
  return cloneQuestionGroups(DEFAULT_PROCESS_SCRIPT_GROUP_TEMPLATES);
}

function buildDefaultQuestionGroups(list = []) {
  const normalizedQuestions = cloneQuestions(list);
  if (!normalizedQuestions.length) return getDefaultProcessScriptGroups();
  return [{ id: PROCESS_SCRIPT_FALLBACK_GROUP.id, nome: PROCESS_SCRIPT_FALLBACK_GROUP.nome, perguntas: normalizedQuestions }];
}

function cloneQuestionGroups(list = []) {
  return (Array.isArray(list) ? list : []).map((group, index) => ({
    id: String(group?.id || "").trim() || `grupo_${index + 1}_${Date.now()}`,
    nome: fixMojibakeText(String(group?.nome || "")).trim() || `Grupo ${index + 1}`,
    perguntas: cloneQuestions(group?.perguntas || []),
  })).filter((group) => group.perguntas.length || group.nome);
}

function normalizeProcessScriptProfile(profile = {}, fallbackId = "") {
  const legacyQuestions = cloneQuestions(profile?.perguntas || []);
  const rawGroups = Array.isArray(profile?.grupos) && profile.grupos.length
    ? cloneQuestionGroups(profile.grupos)
    : buildDefaultQuestionGroups(legacyQuestions.length ? legacyQuestions : DEFAULT_PROCESS_SCRIPT_QUESTIONS);
  const grupos = rawGroups.length ? rawGroups : buildDefaultQuestionGroups(DEFAULT_PROCESS_SCRIPT_QUESTIONS);
  const activeGroupId = grupos.some((group) => group.id === profile?.activeGroupId)
    ? profile.activeGroupId
    : grupos[0].id;
  return {
    id: String(profile?.id || "").trim() || fallbackId || crypto.randomUUID(),
    nome: String(profile?.nome || "").trim() || "Script",
    activeGroupId,
    grupos,
  };
}

function defaultScriptStore() {
  return {
    activeProfileId: "geral",
    profiles: DEFAULT_PROCESS_SCRIPT_PROFILES.map((p) => normalizeProcessScriptProfile(p, p.id)),
  };
}

function getProcessScriptStore() {
  try {
    const rawProfiles = localStorage.getItem(PROCESS_SCRIPT_PROFILES_KEY);
    if (rawProfiles) {
      const parsed = JSON.parse(rawProfiles);
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) {
        const profiles = parsed.profiles.map((p) => normalizeProcessScriptProfile(p)).filter((p) => p.grupos.length);
        if (profiles.length) {
          const activeProfileId = profiles.some((p) => p.id === parsed.activeProfileId)
            ? parsed.activeProfileId
            : profiles[0].id;
          const normalizedStore = { activeProfileId, profiles };
          localStorage.setItem(PROCESS_SCRIPT_PROFILES_KEY, JSON.stringify(normalizedStore));
          return normalizedStore;
        }
      }
    }

    const legacyRaw = localStorage.getItem(PROCESS_SCRIPT_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed) && legacyParsed.length) {
        const store = defaultScriptStore();
        const geral = store.profiles.find((p) => p.id === "geral");
        if (geral) {
          geral.grupos = buildDefaultQuestionGroups(legacyParsed);
          geral.activeGroupId = geral.grupos[0]?.id || "";
        }
        localStorage.setItem(PROCESS_SCRIPT_PROFILES_KEY, JSON.stringify(store));
        return store;
      }
    }
  } catch {}
  const fallback = defaultScriptStore();
  localStorage.setItem(PROCESS_SCRIPT_PROFILES_KEY, JSON.stringify(fallback));
  return fallback;
}

function saveProcessScriptStore(store) {
  localStorage.setItem(PROCESS_SCRIPT_PROFILES_KEY, JSON.stringify(store));
}

function getActiveProcessScriptProfile() {
  const store = getProcessScriptStore();
  const active = store.profiles.find((p) => p.id === store.activeProfileId) || store.profiles[0];
  return { store, active };
}

function getActiveProcessScriptGroup() {
  const { store, active } = getActiveProcessScriptProfile();
  const group = active?.grupos?.find((item) => item.id === active.activeGroupId) || active?.grupos?.[0] || null;
  return { store, active, group };
}

function getProcessScriptQuestions() {
  const { group } = getActiveProcessScriptGroup();
  return cloneQuestions(group?.perguntas || []);
}

function getProcessScriptRowsForTable() {
  const { active } = getActiveProcessScriptProfile();
  return (active?.grupos || []).flatMap((group) =>
    cloneQuestions(group?.perguntas || []).map((question, index) => ({
      grupoId: group.id,
      grupo: group.nome || "Sem grupo",
      ordem: index + 1,
      sourceIndex: index,
      pergunta: question.pergunta,
      exemplo: question.exemplo,
    }))
  );
}

function getProcessScriptRowsForExport() {
  return getProcessScriptRowsForTable().map((row) => ({
    ordem: row.ordem,
    grupo: row.grupo || "Sem grupo",
    pergunta: row.pergunta,
    exemplo: row.exemplo,
  }));
}

function populateProcessScriptProfiles() {
  const select = $("process-script-profile-select");
  if (!select) return;
  const { store } = getActiveProcessScriptProfile();
  select.innerHTML = store.profiles.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}</option>`).join("");
  select.value = store.activeProfileId;
  const deleteBtn = $("btn-process-profile-delete");
  if (deleteBtn) deleteBtn.disabled = store.profiles.length <= 1;
}

function populateProcessScriptGroups() {
  const select = $("process-script-group-select");
  if (!select) return;
  const { active } = getActiveProcessScriptProfile();
  const grupos = active?.grupos || [];
  select.innerHTML = grupos.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.nome)}</option>`).join("");
  select.value = active?.activeGroupId || grupos[0]?.id || "";
  $("btn-process-group-edit").disabled = !grupos.length;
  $("btn-process-group-delete").disabled = grupos.length <= 1;
  const summary = $("process-script-group-summary");
  if (summary) {
    const group = grupos.find((item) => item.id === select.value) || grupos[0];
    const totalQuestions = cloneQuestions(group?.perguntas || []).length;
    summary.textContent = group
      ? `${group.nome}: ${totalQuestions} pergunta${totalQuestions === 1 ? "" : "s"} vinculada${totalQuestions === 1 ? "" : "s"} a este agrupamento.`
      : "Nenhum agrupamento disponível.";
  }
}

function renderProcessScriptQuestions() {
  populateProcessScriptProfiles();
  populateProcessScriptGroups();
  const tbody = $("process-questions-body");
  if (!tbody) return;
  const rows = getProcessScriptRowsForTable();
  const { active } = getActiveProcessScriptProfile();
  const groupOptions = (active?.grupos || [])
    .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.nome)}</option>`)
    .join("");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="resume-text">Nenhuma pergunta cadastrada neste script.</td>`;
    tbody.appendChild(tr);
    return;
  }
  rows.forEach((q, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="proc-q-input process-question-order" data-i="${idx}" data-k="ordem" type="number" min="1" step="1" value="${escapeHtml(q.ordem)}"></td>
      <td>
        <select class="proc-q-input process-question-group-select" data-i="${idx}" data-k="grupoId">
          ${groupOptions}
        </select>
      </td>
      <td><input class="proc-q-input" data-i="${idx}" data-k="pergunta" type="text" value="${escapeHtml(q.pergunta)}"></td>
      <td><input class="proc-q-input" data-i="${idx}" data-k="exemplo" type="text" value="${escapeHtml(q.exemplo)}"></td>
      <td><button class="btn ghost btn-sm btn-proc-q-remove" data-i="${idx}">Excluir</button></td>
    `;
    tbody.appendChild(tr);
    const groupSelect = tr.querySelector('.process-question-group-select');
    if (groupSelect) groupSelect.value = q.grupoId;
  });
  $$(".btn-proc-q-remove").forEach((btn) => btn.addEventListener("click", () => {
    const i = Number(btn.dataset.i);
    const rowsData = getProcessScriptRowsForTable();
    const target = rowsData[i];
    const { store, active } = getActiveProcessScriptProfile();
    if (!active || !target) return;
    const group = active.grupos.find((item) => item.id === target.grupoId);
    if (!group) return;
    group.perguntas.splice(Math.max(0, Number(target.sourceIndex || 0)), 1);
    saveProcessScriptStore(store);
    renderProcessScriptQuestions();
  }));
}

function saveProcessScriptQuestions() {
  const inputs = $$(".proc-q-input");
  const byIndex = {};
  inputs.forEach((el) => {
    const i = Number(el.dataset.i);
    const k = el.dataset.k;
    if (!byIndex[i]) byIndex[i] = { pergunta: "", exemplo: "", grupoId: "", ordem: 1 };
    byIndex[i][k] = el.value.trim();
  });
  const rows = Object.keys(byIndex)
    .map((k) => byIndex[Number(k)])
    .filter((x) => x.pergunta && x.grupoId)
    .map((item, index) => ({
      ...item,
      ordem: Math.max(1, Number(item.ordem) || index + 1),
    }));
  const { store, active } = getActiveProcessScriptProfile();
  if (!active) return;
  const groupedMap = new Map((active.grupos || []).map((group) => [group.id, { ...group, perguntas: [] }]));
  rows
    .sort((a, b) => {
      if (a.grupoId !== b.grupoId) return a.grupoId.localeCompare(b.grupoId, "pt-BR", { sensitivity: "base" });
      if (a.ordem !== b.ordem) return a.ordem - b.ordem;
      return a.pergunta.localeCompare(b.pergunta, "pt-BR", { sensitivity: "base" });
    })
    .forEach((item) => {
      const group = groupedMap.get(item.grupoId);
      if (!group) return;
      group.perguntas.push({
        pergunta: item.pergunta.trim(),
        exemplo: item.exemplo.trim(),
      });
    });
  active.grupos = (active.grupos || []).map((group) => groupedMap.get(group.id) || group);
  saveProcessScriptStore(store);
}

function createProcessScriptProfile() {
  const profileName = window.prompt("Nome do novo script (ex.: Financeiro - Contas a Pagar)", "Novo Script");
  if (!profileName) return;
  const trimmed = profileName.trim();
  if (!trimmed) return;
  const { store, active } = getActiveProcessScriptProfile();
  const id = `custom_${Date.now()}`;
  const gruposBase = cloneQuestionGroups(active?.grupos || []);
  const grupos = gruposBase.length ? gruposBase : buildDefaultQuestionGroups(DEFAULT_PROCESS_SCRIPT_QUESTIONS);
  store.profiles.push({
    id,
    nome: trimmed,
    activeGroupId: grupos[0]?.id || "",
    grupos,
  });
  store.activeProfileId = id;
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function deleteActiveProcessScriptProfile() {
  const { store, active } = getActiveProcessScriptProfile();
  if (!active || store.profiles.length <= 1) return;
  const ok = window.confirm(`Excluir o script "${active.nome}"?`);
  if (!ok) return;
  store.profiles = store.profiles.filter((p) => p.id !== active.id);
  store.activeProfileId = store.profiles[0]?.id || "geral";
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function setActiveProcessScriptProfile(profileId) {
  const { store } = getActiveProcessScriptProfile();
  if (!store.profiles.some((p) => p.id === profileId)) return;
  store.activeProfileId = profileId;
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function setActiveProcessScriptGroup(groupId) {
  const { store, active } = getActiveProcessScriptProfile();
  if (!active?.grupos?.some((group) => group.id === groupId)) return;
  active.activeGroupId = groupId;
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function createProcessScriptGroup() {
  const groupName = window.prompt("Nome do novo agrupamento de perguntas", "Novo agrupamento");
  if (!groupName) return;
  const trimmed = groupName.trim();
  if (!trimmed) return;
  const { store, active } = getActiveProcessScriptProfile();
  if (!active) return;
  const idBase = slugifyProcessScriptGroupName(trimmed);
  const id = active.grupos.some((group) => group.id === idBase) ? `${idBase}_${Date.now()}` : idBase;
  active.grupos.push({ id, nome: trimmed, perguntas: [] });
  active.activeGroupId = id;
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function editActiveProcessScriptGroup() {
  const { store, active, group } = getActiveProcessScriptGroup();
  if (!active || !group) return;
  const nextName = window.prompt("Editar nome do agrupamento", group.nome || "Grupo");
  if (!nextName) return;
  const trimmed = nextName.trim();
  if (!trimmed) return;
  group.nome = trimmed;
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function deleteActiveProcessScriptGroup() {
  const { store, active, group } = getActiveProcessScriptGroup();
  if (!active || !group || active.grupos.length <= 1) return;
  const ok = window.confirm(`Excluir o agrupamento "${group.nome}"? As perguntas dele serão movidas para outro grupo.`);
  if (!ok) return;
  const target = active.grupos.find((item) => item.id !== group.id);
  if (!target) return;
  target.perguntas = [...cloneQuestions(target.perguntas || []), ...cloneQuestions(group.perguntas || [])];
  active.grupos = active.grupos.filter((item) => item.id !== group.id);
  active.activeGroupId = target.id;
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function resetActiveProcessScriptToDefault() {
  const { store, active } = getActiveProcessScriptProfile();
  if (!active) return;
  const defaultProfile = DEFAULT_PROCESS_SCRIPT_PROFILES.find((p) => p.id === active.id);
  active.grupos = cloneQuestionGroups(defaultProfile?.grupos || getDefaultProcessScriptGroups());
  active.activeGroupId = active.grupos[0]?.id || "";
  saveProcessScriptStore(store);
  renderProcessScriptQuestions();
}

function buildProcessScriptExportData() {
  const { active } = getActiveProcessScriptProfile();
  return {
    profileName: active?.nome || "Geral",
    rows: getProcessScriptRowsForExport(),
    generatedAt: new Date(),
  };
}

function downloadProcessScriptWord() {
  const data = buildProcessScriptExportData();
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; color:#0f172a; padding:18px; }
          .header { background:#00034d; color:#fff; padding:16px; border-radius:10px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
          .header-main { flex:1; min-width:0; }
          .header-brand { background:#fff; color:#00034d; border-radius:999px; padding:8px 14px; min-width:120px; text-align:center; }
          .header-brand strong { display:block; font-size:12px; letter-spacing:.8px; }
          .header-brand span { display:block; font-size:9px; letter-spacing:1.1px; }
          .header h1 { margin:0 0 6px 0; font-size:22px; }
          .header p { margin:0; font-size:13px; opacity:.95; }
          .meta { margin:10px 0 14px 0; font-size:12px; color:#334155; }
          table { width:100%; border-collapse:collapse; }
          th, td { border:1px solid #d9e2ec; padding:10px; vertical-align:top; font-size:12px; }
          th { background:#eef4ff; text-align:left; color:#00034d; }
          .idx { width:42px; text-align:center; font-weight:700; color:#00034d; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-main">
            <h1>Roteiro de Perguntas para Gravação por Voz</h1>
            <p>Análise de Processos | Script: ${escapeHtml(data.profileName)}</p>
          </div>
          <div class="header-brand"><strong>SANCHEZ LAB</strong><span>TECNOLOGIA</span></div>
        </div>
        <div class="meta">Gerado em: ${escapeHtml(data.generatedAt.toLocaleString("pt-BR"))}</div>
        <table>
          <thead><tr><th class="idx">Ordem</th><th>Grupo</th><th>Pergunta</th><th>Exemplo de resposta</th></tr></thead>
          <tbody>
            ${data.rows.map((q) => `<tr><td class="idx">${escapeHtml(q.ordem)}</td><td>${escapeHtml(q.grupo || "-")}</td><td><strong>${escapeHtml(q.pergunta)}</strong></td><td>${escapeHtml(q.exemplo || "-")}</td></tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Roteiro_Analise_Processos_${data.profileName.replace(/\s+/g, "_")}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadProcessScriptPdf() {
  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    alert("Biblioteca de PDF não carregada.");
    return;
  }
  const { jsPDF } = jspdfNs;
  const data = buildProcessScriptExportData();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  drawPdfHeader(doc, {
    title: "Roteiro de Perguntas para Gravação por Voz",
    subtitle: `Análise de Processos | Script: ${data.profileName}`,
    margin,
    y,
    pageW,
  });
  y += 82;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gerado em: ${data.generatedAt.toLocaleString("pt-BR")}`, margin, y);
  y += 22;

  const cols = [
    { key: "ordem", title: "Ordem", width: 46, align: "center" },
    { key: "grupo", title: "Grupo", width: 128 },
    { key: "pergunta", title: "Pergunta", width: 178 },
    { key: "exemplo", title: "Exemplo de resposta", width: pageW - margin * 2 - 46 - 128 - 178 },
  ];
  const rowX = cols.reduce((acc, col, index) => {
    const start = index === 0 ? margin : acc[index - 1] + cols[index - 1].width;
    acc.push(start);
    return acc;
  }, []);

  const drawHeader = () => {
    doc.setFillColor(238, 244, 255);
    doc.setDrawColor(217, 226, 236);
    cols.forEach((col, index) => {
      doc.rect(rowX[index], y, col.width, 24, "FD");
      doc.setTextColor(...PDF_TITLE_RGB);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(col.title, rowX[index] + 6, y + 15);
    });
    y += 24;
  };

  drawHeader();

  data.rows.forEach((row) => {
    const lines = cols.map((col) => doc.splitTextToSize(String(row[col.key] || "-"), col.width - 12));
    const rowHeight = Math.max(...lines.map((items) => Math.max(1, items.length))) * 12 + 10;

    if (y + rowHeight > pageH - 36) {
      doc.addPage();
      y = margin;
      drawHeader();
    }

    cols.forEach((col, index) => {
      doc.setDrawColor(217, 226, 236);
      doc.setFillColor(255, 255, 255);
      doc.rect(rowX[index], y, col.width, rowHeight, "FD");
      doc.setTextColor(15, 23, 42);
      doc.setFont(index === 2 ? "helvetica" : "helvetica", index === 2 ? "bold" : "normal");
      doc.setFontSize(9);
      const textX = col.align === "center" ? rowX[index] + (col.width / 2) : rowX[index] + 6;
      doc.text(lines[index], textX, y + 14, col.align === "center" ? { align: "center" } : undefined);
    });

    y += rowHeight;
  });

  doc.save(`Roteiro_Analise_Processos_${data.profileName.replace(/\s+/g, "_")}.pdf`);
}

function hasPermission(viewId) {
  return currentPermissions.includes("*") || currentPermissions.includes(viewId);
}

async function loadCurrentUser() {
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
    currentPermissions = data.user.permissions || [];
    applyMenuPermissions();
    if (currentUser.must_change_password) {
      $("must-change-password-modal").classList.remove("hidden");
    }
  } catch {
    window.location.href = "/login";
  }
}

function applyMenuPermissions() {
  $$(".menu-item[data-view]").forEach((btn) => {
    const view = btn.dataset.view;
    btn.classList.toggle("hidden", !hasPermission(view));
  });
}

function parseDate(value) {
  if (!value) return null;
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function dateLabel(value) {
  const dt = parseDate(value);
  return dt ? dt.toLocaleDateString("pt-BR") : "-";
}

function formatDatePtBr(dt) {
  return dt ? dt.toLocaleDateString("pt-BR") : "-";
}

function diffDays(start, end) {
  if (!start || !end) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86400000);
}

function setActiveView(viewId) {
  $$(".module-view").forEach((v) => v.classList.toggle("hidden", v.id !== viewId));
  $$(".menu-item").forEach((b) => b.classList.toggle("active", b.dataset.view === viewId));
}

function getMenuGroupsState() {
  try {
    const raw = localStorage.getItem(MENU_GROUPS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function setMenuGroupCollapsed(groupName, collapsed) {
  const container = document.querySelector(`.menu-group[data-group="${groupName}"]`);
  const toggle = document.querySelector(`.menu-group-toggle[data-group="${groupName}"]`);
  if (!container || !toggle) return;
  container.classList.toggle("collapsed-group", collapsed);
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function initMenuGroups() {
  const state = getMenuGroupsState();
  $$(".menu-group-toggle").forEach((btn) => {
    const group = btn.dataset.group;
    if (!group) return;
    const shouldCollapse = state[group] !== undefined ? !!state[group] : true;
    setMenuGroupCollapsed(group, shouldCollapse);
  });
}

function activatePreviewTab(doc) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.doc === doc));
  $$(".editor").forEach((e) => e.classList.add("hidden"));
  const editor = $(`editor-${doc}`);
  if (editor) editor.classList.remove("hidden");
}

function syncConfigInputs(state) {
  const active = document.activeElement;
  if (configDirty || active === $("origem_path") || active === $("destino_path")) return;
  $("origem_path").value = state.origem_path || "";
  $("destino_path").value = state.destino_path || "";
}

function showPreview(preview) {
  if (!preview) return;
  currentPreview = preview;
  $("preview-title").textContent = `Pré-visualização: ${preview.doc.filename}`;
  $("editor-ficha_tecnica").value = preview.documents.ficha_tecnica || "";
  $("editor-fluxograma").value = preview.documents.fluxograma || "";
  $("editor-riscos").value = preview.documents.riscos || "";
  activatePreviewTab("ficha_tecnica");
  $("preview-modal").classList.remove("hidden");
}

function hidePreview() {
  currentPreview = null;
  $("preview-modal").classList.add("hidden");
}

async function openPreviewByIndex(index) {
  const data = await api(`/api/process/preview/${index}`);
  showPreview(data.preview);
}

function renderDocsTable(docs) {
  const tbody = $("documents-body");
  tbody.innerHTML = "";
  docs.forEach((doc, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input type="checkbox" class="doc-select" data-index="${i}" ${doc.selected ? "checked" : ""} ${doc.processed ? "disabled" : ""}></td><td>${escapeHtml(doc.departamento || "")}</td><td>${escapeHtml(doc.subarea || "")}</td><td>${escapeHtml(doc.filename || "")}</td><td>${escapeHtml(statusLabel(doc.status))}</td><td>${doc.preview_ready ? `<button class="btn ghost btn-row-preview" data-index="${i}">Preview</button>` : `<button class="btn ghost" disabled>Preview</button>`}</td>`;
    tbody.appendChild(tr);
  });
  $$(".doc-select").forEach((el) => el.addEventListener("change", onDocSelectionChange));
  $$(".btn-row-preview").forEach((el) => el.addEventListener("click", () => openPreviewByIndex(Number(el.dataset.index))));
}

function renderProcessState(state) {
  syncConfigInputs(state);
  $("progress-label").textContent = `${state.selected_processed}/${state.selected_total} documentos selecionados processados`;
  $("progress-percent").textContent = `${state.selected_progress_percent}%`;
  $("progress-bar").style.width = `${state.selected_progress_percent}%`;
  const docs = state.documents || [];
  const selected = docs.filter((d) => d.selected);
  $("kpi-processed").textContent = String(selected.filter((d) => d.processed).length);
  $("kpi-waiting").textContent = String(selected.filter((d) => d.status === "aguardando_aprovacao").length);
  $("kpi-pending").textContent = String(selected.filter((d) => !d.processed && d.status !== "aguardando_aprovacao").length);
  renderDocsTable(docs);
}

async function refreshProcessState() { renderProcessState(await api("/api/state")); }
async function refreshLogs() {
  const data = await api("/api/logs");
  $("log-summary").textContent = (data.summary || []).join("\n");
  $("log-detailed").textContent = (data.detailed || []).join("\n");
}

async function saveConfig() {
  await api("/api/config", { method: "POST", body: JSON.stringify({ origem_path: $("origem_path").value.trim(), destino_path: $("destino_path").value.trim() }) });
  configDirty = false;
}

let selectionRequestPending = false;
let queuedSelectionAction = null;
async function setDocSelection(mode, indices = []) {
  if (selectionRequestPending) {
    queuedSelectionAction = { mode, indices };
    return;
  }
  selectionRequestPending = true;
  try {
    const data = await api("/api/documents/select", { method: "POST", body: JSON.stringify({ mode, indices }) });
    renderProcessState(data.state);
  } finally {
    selectionRequestPending = false;
    if (queuedSelectionAction) {
      const next = queuedSelectionAction;
      queuedSelectionAction = null;
      await setDocSelection(next.mode, next.indices);
    }
  }
}

async function onDocSelectionChange() {
  const selected = $$(".doc-select").filter((e) => e.checked).map((e) => Number(e.dataset.index));
  await setDocSelection("set", selected);
}

function fileListToMeta(files) {
  return Array.from(files || []).map((f) => ({ id: crypto.randomUUID(), nome: f.name, tipo: f.type || "", tamanho: f.size || 0, url: "" }));
}

function updateStageCodes(containerId = "etapas-container") {
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll(".stage-item").forEach((row, i) => {
    const code = `ETP-${String(i + 1).padStart(3, "0")}`;
    row.dataset.code = code;
    const badge = row.querySelector(".stage-code");
    if (badge) badge.textContent = code;
  });
}

function createStageRowMarkup(initial = {}, isEdit = false) {
  const prefix = isEdit ? "edit-" : "";
  return `<div class="row between center"><h4><span class="stage-code">ETP-000</span> Etapa</h4><div class="row gap"><button class="btn ghost btn-stage-toggle" type="button">Minimizar</button><button class="btn ghost btn-stage-remove" type="button" title="Excluir etapa" aria-label="Excluir etapa">${ICON_TRASH}</button></div></div><div class="stage-body"><div class="grid two"><label>Nome da etapa<input class="${prefix}etp-nome" type="text" value="${escapeHtml(initial.nome || "")}"></label><label>Responsável<select class="${prefix}etp-responsavel"></select></label><label>Início previsto<input class="${prefix}etp-inicio-previsto" type="date" value="${escapeHtml(initial.inicio_previsto || "")}"></label><label>Início real<input class="${prefix}etp-inicio-real" type="date" value="${escapeHtml(initial.inicio_real || "")}"></label><label>Fim previsto<input class="${prefix}etp-fim-previsto" type="date" value="${escapeHtml(initial.fim_previsto || initial.prazo || "")}"></label><label>Fim real<input class="${prefix}etp-fim-real" type="date" value="${escapeHtml(initial.fim_real || "")}"></label><label>Status<select class="${prefix}etp-status"><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option><option value="bloqueada">Bloqueada</option><option value="atrasada">Atrasada</option></select></label><label>Criticidade<select class="${prefix}etp-criticidade"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label><label>Complexidade<select class="${prefix}etp-complexidade"><option value="simples">Simples</option><option value="moderada">Moderada</option><option value="complexa">Complexa</option></select></label></div><label style="margin-top:8px;">Descrição<textarea class="${prefix}etp-descricao" rows="2">${escapeHtml(initial.descricao || "")}</textarea></label><label style="margin-top:8px;">Anotações<textarea class="${prefix}etp-anotacoes" rows="2">${escapeHtml(initial.anotacoes || "")}</textarea></label>${isEdit ? "" : '<label style="margin-top:8px;">Anexos da etapa<input class="etp-anexos" type="file" multiple></label>'}</div>`;
}

function configureProjectStageResponsavelSelect(node, initial = {}, isEdit = false) {
  const prefix = isEdit ? "edit-" : "";
  const select = node.querySelector(`.${prefix}etp-responsavel`);
  if (!select) return;
  if (!select.id) select.id = `stage-responsavel-${crypto.randomUUID()}`;
  const users = Array.isArray(usuariosCache) ? usuariosCache : [];
  const options = users.map((user) => ({ id: user.id, nome: normalizeUserDisplayName(user) }));
  const fallbackName = String(initial.responsavel || "").trim();
  const selectedId = initial.responsavel_id || findUserIdByName(fallbackName);
  if (!selectedId && fallbackName) {
    options.push({ id: createFallbackPersonValue(fallbackName), nome: fallbackName });
  }
  renderSimpleOptions(select.id, options, "Selecione...");
  if (selectedId) select.value = selectedId;
  else if (fallbackName) select.value = createFallbackPersonValue(fallbackName);
  SEARCHABLE_SELECT_CONFIGS[select.id] = {
    multiple: false,
    placeholder: "Selecione um responsável",
    searchPlaceholder: "Buscar usuário...",
    emptyText: "Nenhum usuário encontrado.",
  };
  buildSearchableSelectControl(select.id);
}

function refreshProjectStageResponsavelSelects() {
  $$(".stage-item .etp-responsavel").forEach((select) => {
    const currentValue = select.value || "";
    if (!select.id) select.id = `stage-responsavel-${crypto.randomUUID()}`;
    const users = Array.isArray(usuariosCache) ? usuariosCache : [];
    const options = users.map((user) => ({ id: user.id, nome: normalizeUserDisplayName(user) }));
    renderSimpleOptions(select.id, options, "Selecione...");
    if (currentValue) select.value = currentValue;
    SEARCHABLE_SELECT_CONFIGS[select.id] = {
      multiple: false,
      placeholder: "Selecione um responsável",
      searchPlaceholder: "Buscar usuário...",
      emptyText: "Nenhum usuário encontrado.",
    };
    buildSearchableSelectControl(select.id);
  });
  $$(".stage-item .edit-etp-responsavel").forEach((select) => {
    const currentValue = select.value || "";
    if (!select.id) select.id = `stage-responsavel-${crypto.randomUUID()}`;
    const users = Array.isArray(usuariosCache) ? usuariosCache : [];
    const options = users.map((user) => ({ id: user.id, nome: normalizeUserDisplayName(user) }));
    renderSimpleOptions(select.id, options, "Selecione...");
    if (currentValue) select.value = currentValue;
    SEARCHABLE_SELECT_CONFIGS[select.id] = {
      multiple: false,
      placeholder: "Selecione um responsável",
      searchPlaceholder: "Buscar usuário...",
      emptyText: "Nenhum usuário encontrado.",
    };
    buildSearchableSelectControl(select.id);
  });
}

function addStageRow(initial = {}) {
  const container = $("etapas-container");
  const node = document.createElement("div");
  node.className = "stage-item";
  node.dataset.id = initial.id || crypto.randomUUID();
  node.innerHTML = createStageRowMarkup(initial, false);
  container.appendChild(node);
  configureProjectStageResponsavelSelect(node, initial, false);
  node.querySelector(".etp-status").value = initial.status || "pendente";
  node.querySelector(".etp-criticidade").value = initial.criticidade || "media";
  node.querySelector(".etp-complexidade").value = initial.complexidade || "moderada";
  node.querySelector(".btn-stage-remove").addEventListener("click", () => { node.remove(); updateStageCodes("etapas-container"); });
  node.querySelector(".btn-stage-toggle").addEventListener("click", (e) => {
    const body = node.querySelector(".stage-body");
    const collapsed = body.classList.toggle("hidden");
    e.currentTarget.textContent = collapsed ? "Expandir" : "Minimizar";
  });
  updateStageCodes("etapas-container");
}

function addEditStageRow(initial = {}) {
  const container = $("edit-etapas-container");
  const node = document.createElement("div");
  node.className = "stage-item";
  node.dataset.id = initial.id || crypto.randomUUID();
  node.innerHTML = createStageRowMarkup(initial, true);
  container.appendChild(node);
  configureProjectStageResponsavelSelect(node, initial, true);
  node.querySelector(".edit-etp-status").value = initial.status || "pendente";
  node.querySelector(".edit-etp-criticidade").value = initial.criticidade || "media";
  node.querySelector(".edit-etp-complexidade").value = initial.complexidade || "moderada";
  node.querySelector(".btn-stage-remove").addEventListener("click", () => { node.remove(); updateStageCodes("edit-etapas-container"); });
  node.querySelector(".btn-stage-toggle").addEventListener("click", (e) => {
    const body = node.querySelector(".stage-body");
    const collapsed = body.classList.toggle("hidden");
    e.currentTarget.textContent = collapsed ? "Expandir" : "Minimizar";
  });
  updateStageCodes("edit-etapas-container");
}

function collectStages(containerId = "etapas-container", edit = false) {
  const container = $(containerId);
  const prefix = edit ? "edit-" : "";
  const rows = container.querySelectorAll(".stage-item");
  const stages = Array.from(rows).map((row) => ({
    id: row.dataset.id || crypto.randomUUID(),
    nome: row.querySelector(`.${prefix}etp-nome`).value.trim(),
    responsavel: parsePersonSelection(row.querySelector(`.${prefix}etp-responsavel`).value).name
      || getSelectOptionLabel(row.querySelector(`.${prefix}etp-responsavel`).id, row.querySelector(`.${prefix}etp-responsavel`).value)
      || "",
    inicio_previsto: row.querySelector(`.${prefix}etp-inicio-previsto`).value,
    inicio_real: row.querySelector(`.${prefix}etp-inicio-real`).value,
    fim_previsto: row.querySelector(`.${prefix}etp-fim-previsto`).value,
    fim_real: row.querySelector(`.${prefix}etp-fim-real`).value,
    prazo: row.querySelector(`.${prefix}etp-fim-previsto`).value,
    status: row.querySelector(`.${prefix}etp-status`).value,
    criticidade: row.querySelector(`.${prefix}etp-criticidade`).value,
    complexidade: row.querySelector(`.${prefix}etp-complexidade`).value,
    descricao: row.querySelector(`.${prefix}etp-descricao`).value.trim(),
    anotacoes: row.querySelector(`.${prefix}etp-anotacoes`).value.trim(),
    anexos: edit ? [] : fileListToMeta(row.querySelector(".etp-anexos")?.files || []),
  }));
  stages.sort((a, b) => (a.fim_previsto || a.prazo || "9999-12-31").localeCompare(b.fim_previsto || b.prazo || "9999-12-31"));
  return stages;
}
function buildProjectPayload() {
  return {
    nome: $("proj-nome").value.trim(),
    responsavel_id: $("proj-responsavel").value,
    focal_id: $("proj-focal").value,
    descricao: $("proj-descricao").value.trim(),
    data_inicio_previsto: $("proj-data-inicio-previsto").value,
    dt_inicio_real: $("proj-data-inicio-real").value,
    previsao_termino: $("proj-previsao-termino").value,
    termino_real: $("proj-termino-real").value,
    status: $("proj-status").value,
    criticidade: $("proj-criticidade").value,
    setor_projeto: $("proj-setor").value,
    participantes_ids: getSelectValues("proj-participantes"),
    anexos: fileListToMeta($("proj-anexos").files),
    etapas: collectStages("etapas-container", false),
    anotacoes_gerais: $("proj-anotacoes-gerais").value.trim(),
    anotacoes: [],
    orcamento: Number($("proj-orcamento").value || 0),
    custo_atual: Number($("proj-custo-atual").value || 0),
  };
}

function clearProjectForm() {
  ["proj-nome", "proj-descricao", "proj-data-inicio-previsto", "proj-data-inicio-real", "proj-previsao-termino", "proj-termino-real", "proj-anotacoes-gerais", "proj-orcamento", "proj-custo-atual"].forEach((id) => { $(id).value = ""; });
  $("proj-responsavel").value = "";
  $("proj-focal").value = "";
  setSelectValues("proj-participantes", []);
  buildSearchableSelectControl("proj-responsavel");
  buildSearchableSelectControl("proj-focal");
  buildSearchableSelectControl("proj-participantes");
  $("proj-status").value = "backlog";
  $("proj-criticidade").value = "media";
  $("etapas-container").innerHTML = "";
  addStageRow();
}

async function submitProject() {
  $("proj-form-msg").textContent = "";
  try {
    const response = await api("/api/projects", { method: "POST", body: JSON.stringify(buildProjectPayload()) });
    $("proj-form-msg").style.color = "green";
    $("proj-form-msg").textContent = `Projeto cadastrado: ${response.project.nome}`;
    clearProjectForm();
    await Promise.all([loadProjects(), loadDashboard()]);
  } catch (error) {
    $("proj-form-msg").style.color = "var(--danger)";
    $("proj-form-msg").textContent = error.message;
  }
}

function renderConsultaKpis(projects) {
  const now = new Date();
  const total = projects.length;
  const ativos = projects.filter((p) => ["em_andamento", "proxima_sprint"].includes(p.status)).length;
  const atrasados = projects.filter((p) => {
    const fim = parseDate(p.previsao_termino);
    return fim && fim < now && p.status !== "concluido" && !p.termino_real;
  }).length;
  $("consulta-kpi-total").textContent = String(total);
  $("consulta-kpi-ativos").textContent = String(ativos);
  $("consulta-kpi-atrasados").textContent = String(atrasados);
}

function showProjectDetails(project) {
  const etapas = (project.etapas || []).map((e) => `<li><strong>${escapeHtml(e.nome || "-")}</strong> - ${escapeHtml(statusLabel(e.status))} - prazo: ${escapeHtml(dateLabel(e.prazo))} <button type="button" class="btn ghost btn-sm btn-detail-delete-stage" data-stage-id="${escapeHtml(e.id || "")}" title="Excluir etapa" aria-label="Excluir etapa">${ICON_TRASH}</button></li>`).join("");
  const anotacoes = Array.isArray(project.anotacoes) ? project.anotacoes : [];
  const anotacoesHtml = anotacoes.length
    ? anotacoes.map((a) => {
      const respostas = Array.isArray(a.respostas) ? a.respostas : [];
      const respostasHtml = respostas.length
        ? `<div class="comment-replies">${respostas.map((r) => `<div class="comment-reply"><strong>${escapeHtml(r.usuario || "-")}:</strong> ${escapeHtml(r.conteudo || "")} <span>${escapeHtml(r.data ? new Date(r.data).toLocaleString("pt-BR") : "-")}</span></div>`).join("")}</div>`
        : "";
      return `<article class="comment-item"><header><strong>${escapeHtml(a.usuario || "-")}</strong><span>${escapeHtml(a.data ? new Date(a.data).toLocaleString("pt-BR") : "-")}</span></header><p><strong>Status:</strong> ${escapeHtml(statusLabel(a.status || "pendente"))}</p><p>${escapeHtml(a.conteudo || "")}</p>${respostasHtml}</article>`;
    }).join("")
    : `<p class="resume-text">Nenhum comentário registrado.</p>`;

  $("project-details-content").innerHTML = `
    <div class="kpi-grid three">
      <article class="kpi-card"><h4>Status</h4><strong>${escapeHtml(statusLabel(project.status))}</strong></article>
      <article class="kpi-card"><h4>Progresso</h4><strong>${Number(project.progresso || 0)}%</strong></article>
      <article class="kpi-card"><h4>Etapas</h4><strong>${(project.etapas || []).length}</strong></article>
    </div>
    <div style="margin-top:10px;" class="details-grid">
      <p><strong>Projeto:</strong> ${escapeHtml(project.nome)}</p>
      <p><strong>Responsável:</strong> ${escapeHtml(project.responsavel || "-")}</p>
      <p><strong>Focal:</strong> ${escapeHtml(project.focal || "-")}</p>
      <p><strong>Participantes:</strong> ${escapeHtml((project.participantes || project.setores_impactados || []).join(", ") || "-")}</p>
      <p><strong>Setor:</strong> ${escapeHtml(project.setor_projeto || "-")}</p>
      <p><strong>Início previsto:</strong> ${escapeHtml(dateLabel(project.data_inicio_previsto || project.dt_inicio_real))}</p>
      <p><strong>Término previsto:</strong> ${escapeHtml(dateLabel(project.previsao_termino || project.termino_real))}</p>
      <p><strong>Descrição:</strong> ${escapeHtml(project.descricao || "-")}</p>
    </div>
    <div class="actions-wrap" style="margin-top:12px;">
      <button type="button" class="btn ghost btn-sm" id="btn-detail-edit">Editar projeto</button>
      <button type="button" class="btn ghost btn-sm" id="btn-detail-add-stage">Incluir etapa</button>
      <button type="button" class="btn ghost btn-sm" id="btn-detail-delete-project" title="Excluir projeto" aria-label="Excluir projeto">${ICON_TRASH} Excluir projeto</button>
    </div>
    <h4 style="margin-top:12px;">Etapas</h4>
    <ul>${etapas || "<li>Sem etapas</li>"}</ul>
    <h4 style="margin-top:12px;">Anotações</h4>
    <div class="comment-list">${anotacoesHtml}</div>
    <div class="comment-form" style="margin-top:10px;">
      <label>Novo comentário
        <textarea id="detail-comment-text" rows="3" placeholder="Escreva um comentário para o projeto..."></textarea>
      </label>
      <div class="row end" style="margin-top:8px;">
        <button class="btn btn-sm" id="btn-detail-comment-save">Adicionar comentário</button>
      </div>
      <p id="detail-comment-msg" class="error-text"></p>
    </div>
  `;
  $("project-details-modal").classList.remove("hidden");
  $("btn-detail-edit").addEventListener("click", async () => { $("project-details-modal").classList.add("hidden"); await openProjectEdit(project.id); });
  $("btn-detail-add-stage").addEventListener("click", async () => { $("project-details-modal").classList.add("hidden"); await openProjectEdit(project.id); addEditStageRow(); });
  $("btn-detail-delete-project").addEventListener("click", async () => {
    const deleted = await deleteProjectById(project.id);
    if (!deleted) return;
    $("project-details-modal").classList.add("hidden");
  });
  $$(".btn-detail-delete-stage").forEach((btn) => btn.addEventListener("click", async () => {
    const stageId = btn.dataset.stageId;
    if (!stageId) return;
    const deleted = await deleteProjectStage(project.id, stageId);
    if (!deleted) return;
    const updated = (await api(`/api/projects/${project.id}`)).project;
    showProjectDetails(updated);
    if (hasPermission("view-projetos-consultar")) await loadProjects();
    if (hasPermission("view-projetos-dashboard")) await loadDashboard();
  }));
  $("btn-detail-comment-save").addEventListener("click", async () => {
    const msg = $("detail-comment-msg");
    msg.textContent = "";
    const text = $("detail-comment-text").value.trim();
    if (!text) {
      msg.textContent = "Digite um comentário antes de salvar.";
      return;
    }
    await addQuickComment(project.id, text);
    const updated = (await api(`/api/projects/${project.id}`)).project;
    showProjectDetails(updated);
    if (hasPermission("view-projetos-consultar")) await loadProjects();
    if (hasPermission("view-projetos-dashboard")) await loadDashboard();
  });
}

async function fetchAndShowDetails(projectId) {
  const data = await api(`/api/projects/${projectId}`);
  showProjectDetails(data.project);
}

function summaryText(project) {
  const etapas = (project.etapas || []).length;
  const ini = dateLabel(project.data_inicio_previsto || project.dt_inicio_real);
  const fim = dateLabel(project.previsao_termino || project.termino_real);
  return `Etapas: ${etapas} | Início: ${ini} | Término: ${fim}`;
}

function renderProjectsList(projects) {
  const tbody = $("projects-list-body");
  tbody.innerHTML = "";
  projects.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(p.nome || "")}</td><td>${escapeHtml(p.responsavel || "")}</td><td>${escapeHtml(p.focal || "-")}</td><td>${escapeHtml(statusLabel(p.status))}</td><td>${escapeHtml(statusLabel(p.criticidade))}</td><td>${escapeHtml(p.setor_projeto || "")}</td><td>${Number(p.progresso || 0)}%</td><td><span class="resume-text">${escapeHtml(summaryText(p))}</span></td><td><div class="actions-wrap"><button type="button" class="btn ghost btn-sm btn-proj-detalhes" data-id="${p.id}">Detalhes</button><button type="button" class="btn ghost btn-sm btn-proj-editar" data-id="${p.id}">Editar</button><button type="button" class="btn ghost btn-sm btn-proj-delete" data-id="${p.id}" title="Excluir projeto" aria-label="Excluir projeto">${ICON_TRASH}</button></div></td>`;
    tbody.appendChild(tr);
  });
  $$(".btn-proj-detalhes").forEach((btn) => btn.addEventListener("click", () => fetchAndShowDetails(btn.dataset.id)));
  $$(".btn-proj-editar").forEach((btn) => btn.addEventListener("click", () => openProjectEdit(btn.dataset.id)));
  $$(".btn-proj-delete").forEach((btn) => btn.addEventListener("click", () => deleteProjectById(btn.dataset.id)));
}

function renderProjectsCards(projects) {
  const wrap = $("projects-cards");
  wrap.innerHTML = "";
  projects.forEach((p) => {
    const card = document.createElement("article");
    card.className = "project-card";
    card.innerHTML = `<h4>${escapeHtml(p.nome || "")}</h4><p><strong>Status:</strong> ${escapeHtml(statusLabel(p.status))}</p><p><strong>Responsável:</strong> ${escapeHtml(p.responsavel || "")}</p><p><strong>Focal:</strong> ${escapeHtml(p.focal || "-")}</p><p><strong>Setor:</strong> ${escapeHtml(p.setor_projeto || "-")}</p><p><strong>Progresso:</strong> ${Number(p.progresso || 0)}%</p><p class="resume-text">${escapeHtml(summaryText(p))}</p><div class="actions-wrap row end"><button type="button" class="btn ghost btn-sm btn-card-edit" data-id="${p.id}">Editar</button><button type="button" class="btn ghost btn-sm btn-card-delete" data-id="${p.id}" title="Excluir projeto" aria-label="Excluir projeto">${ICON_TRASH}</button><button type="button" class="btn ghost btn-card-detalhes-min btn-card-detalhes" data-id="${p.id}" title="Detalhes">${ICON_ELLIPSIS}</button></div>`;
    wrap.appendChild(card);
  });
  $$(".btn-card-detalhes").forEach((btn) => btn.addEventListener("click", () => fetchAndShowDetails(btn.dataset.id)));
  $$(".btn-card-edit").forEach((btn) => btn.addEventListener("click", () => openProjectEdit(btn.dataset.id)));
  $$(".btn-card-delete").forEach((btn) => btn.addEventListener("click", () => deleteProjectById(btn.dataset.id)));
}

function setProjectViewMode(mode) {
  projectViewMode = mode;
  $("consulta-lista-wrap").classList.toggle("hidden", mode !== "lista");
  $("consulta-cards-wrap").classList.toggle("hidden", mode !== "cards");
  $("btn-view-lista").classList.toggle("active-log", mode === "lista");
  $("btn-view-cards").classList.toggle("active-log", mode === "cards");
}

async function loadProjects() {
  const params = new URLSearchParams();
  const statusValues = getMultiFilterValues("flt-status");
  if ($("flt-nome").value.trim()) params.set("nome", $("flt-nome").value.trim());
  if (statusValues.length === 1) params.set("status", statusValues[0]);
  if ($("flt-responsavel").value.trim()) params.set("responsavel", $("flt-responsavel").value.trim());
  if ($("flt-data-inicio").value) params.set("data_inicio", $("flt-data-inicio").value);
  if ($("flt-data-fim").value) params.set("data_fim", $("flt-data-fim").value);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await api(`/api/projects${query}`);
  let projects = data.projects || [];
  if (statusValues.length > 1) {
    const allowed = new Set(statusValues);
    projects = projects.filter((p) => allowed.has(String(p.status || "")));
  }
  renderConsultaKpis(projects);
  renderProjectsList(projects);
  renderProjectsCards(projects);
}

async function deleteProjectById(projectId) {
  if (!projectId) return false;
  if (!confirm("Deseja excluir este projeto? Esta ação não pode ser desfeita.")) return false;
  try {
    const attempts = [];
    try {
      const current = (await api(`/api/projects/${projectId}`)).project;
      await api(`/api/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify({ ...(current || {}), _action: "delete" }),
      });
    } catch (error) {
      attempts.push(String(error.message || "falha ao excluir via PUT"));
    }
    if (attempts.length) {
      try {
        await api(`/api/projects/${projectId}/delete`, { method: "POST" });
        attempts.length = 0;
      } catch (error) {
        attempts.push(String(error.message || "falha ao excluir via POST /delete"));
      }
    }
    if (attempts.length) {
      try {
        await api("/api/projects/delete", {
          method: "POST",
          body: JSON.stringify({ project_id: projectId }),
        });
        attempts.length = 0;
      } catch (error) {
        attempts.push(String(error.message || "falha ao excluir via POST payload"));
      }
    }
    if (attempts.length) {
      try {
        await api(`/api/projects/${projectId}`, { method: "DELETE" });
        attempts.length = 0;
      } catch (error) {
        attempts.push(String(error.message || "falha ao excluir via DELETE"));
      }
    }
    const verifyList = await api("/api/projects");
    const stillExists = (verifyList.projects || []).some((p) => String(p.id || "") === String(projectId));
    if (stillExists) {
      const details = attempts.length ? ` Tentativas: ${attempts.join(" | ")}` : "";
      throw new Error(`Exclusão não confirmada no backend (recarregue/reinicie o servidor e tente novamente).${details}`);
    }
    const refreshTasks = [];
    if (hasPermission("view-projetos-consultar")) refreshTasks.push(loadProjects());
    if (hasPermission("view-projetos-dashboard")) refreshTasks.push(loadDashboard());
    if (refreshTasks.length) await Promise.all(refreshTasks);
    return true;
  } catch (error) {
    alert(`Falha ao excluir projeto: ${String(error.message || "erro desconhecido")}`);
    return false;
  }
}

async function deleteProjectStage(projectId, stageId) {
  if (!projectId || !stageId) return false;
  if (!confirm("Deseja excluir esta etapa?")) return false;
  try {
    // caminho robusto: remove etapa via GET + PUT do projeto
    const current = (await api(`/api/projects/${projectId}`)).project;
    const etapas = (current.etapas || []).filter((e) => String(e.id || "") !== String(stageId));
    await api(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify({ ...current, etapas }) });

    // verificação de persistência
    const after = (await api(`/api/projects/${projectId}`)).project;
    if ((after.etapas || []).some((e) => String(e.id || "") === String(stageId))) {
      throw new Error("Etapa não foi removida no backend.");
    }
    return true;
  } catch (error) {
    try {
      const attempts = [String(error.message || "falha inicial de exclusão da etapa")];
      try {
        await api(`/api/projects/${projectId}/stages/${stageId}/delete`, { method: "POST" });
        attempts.length = 0;
      } catch (error2) {
        attempts.push(String(error2.message || "falha via POST stage/delete"));
      }
      if (attempts.length) {
        try {
          await api(`/api/projects/${projectId}/stages/${stageId}`, { method: "DELETE" });
          attempts.length = 0;
        } catch (error3) {
          attempts.push(String(error3.message || "falha via DELETE stage"));
        }
      }
      if (attempts.length) {
        const current = (await api(`/api/projects/${projectId}`)).project;
        const etapas = (current.etapas || []).filter((e) => String(e.id || "") !== String(stageId));
        const payload = { ...current, etapas };
        await api(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      const after = (await api(`/api/projects/${projectId}`)).project;
      if ((after.etapas || []).some((e) => String(e.id || "") === String(stageId))) {
        const details = attempts.length ? ` Tentativas: ${attempts.join(" | ")}` : "";
        throw new Error(`Etapa não foi removida no backend.${details}`);
      }
      return true;
    } catch (error2) {
      alert(`Falha ao excluir etapa: ${String(error2.message || "erro desconhecido")}`);
      return false;
    }
  }
}

async function loadSetores() {
  const data = await api("/api/setores");
  const setores = data.setores || [];
  const tbody = $("setores-body");
  tbody.innerHTML = "";
  setores.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(s.nome)}</td><td><button class="btn ghost btn-del-setor" data-id="${s.id}">Excluir</button></td>`;
    tbody.appendChild(tr);
  });
  $$(".btn-del-setor").forEach((btn) => btn.addEventListener("click", async () => {
    await api(`/api/setores/${btn.dataset.id}`, { method: "DELETE" });
    await loadSetores();
  }));
  const select = $("proj-setor");
  const current = select.value;
  select.innerHTML = `<option value="">Selecione...</option>${setores.map((s) => `<option value="${escapeHtml(s.nome)}">${escapeHtml(s.nome)}</option>`).join("")}`;
  if (current) select.value = current;
  await loadDepartamentos();
}

async function addSetor() {
  $("setor-msg").textContent = "";
  const nome = $("setor-nome").value.trim();
  if (!nome) return void ($("setor-msg").textContent = "Informe o nome do setor.");
  try {
    await api("/api/setores", { method: "POST", body: JSON.stringify({ nome }) });
    $("setor-nome").value = "";
    await loadSetores();
  } catch (error) {
    $("setor-msg").textContent = error.message;
  }
}

function renderSimpleOptions(selectId, items, placeholder = "Selecione...", selected = "") {
  const sel = $(selectId);
  if (!sel) return;
  const rows = Array.isArray(items) ? items : [];
  const prev = getMultiFilterValues(selectId);
  const prevSearchableValues = getSelectValues(selectId);
  sel.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${rows.map((x) => `<option value="${x.id}">${escapeHtml(x.nome || "")}</option>`).join("")}`;
  if (selected) sel.value = selected;
  if (MULTI_FILTER_IDS.has(selectId)) {
    const available = new Set(rows.map((x) => String(x.id)));
    const keep = prev.filter((v) => available.has(v));
    buildMultiFilterControl(selectId);
    setMultiFilterValues(selectId, keep);
  }
  if (SEARCHABLE_SELECT_CONFIGS[selectId]) {
    const available = new Set(rows.map((x) => String(x.id)));
    const keep = prevSearchableValues.filter((v) => available.has(v));
    setSelectValues(selectId, keep);
    buildSearchableSelectControl(selectId);
  }
}

function updateResponsavelSelects() {
  const users = Array.isArray(usuariosCache) ? usuariosCache : [];
  const options = users.map((u) => ({ id: u.id, nome: normalizeUserDisplayName(u) }));
  renderSimpleOptions("proc-responsavel", options, "Selecione...");
}

function renderProjectUserSelects() {
  const users = Array.isArray(usuariosCache) ? usuariosCache : [];
  const options = users.map((u) => ({ id: u.id, nome: normalizeUserDisplayName(u) }));

  const projectRespCurrent = $("proj-responsavel")?.value || "";
  const editRespCurrent = $("edit-proj-responsavel")?.value || "";
  const projectFocalCurrent = $("proj-focal")?.value || "";
  const editFocalCurrent = $("edit-proj-focal")?.value || "";
  const projectParticipantsCurrent = getSelectValues("proj-participantes");
  const editParticipantsCurrent = getSelectValues("edit-proj-participantes");

  renderSimpleOptions("proj-responsavel", options, "Selecione...");
  renderSimpleOptions("edit-proj-responsavel", options, "Selecione...");
  renderSimpleOptions("proj-focal", options, "Selecione...");
  renderSimpleOptions("edit-proj-focal", options, "Selecione...");
  renderSimpleOptions("proj-participantes", options, "Selecione...");
  renderSimpleOptions("edit-proj-participantes", options, "Selecione...");

  if (projectRespCurrent) $("proj-responsavel").value = projectRespCurrent;
  if (editRespCurrent) $("edit-proj-responsavel").value = editRespCurrent;
  if (projectFocalCurrent) $("proj-focal").value = projectFocalCurrent;
  if (editFocalCurrent) $("edit-proj-focal").value = editFocalCurrent;
  setSelectValues("proj-participantes", projectParticipantsCurrent);
  setSelectValues("edit-proj-participantes", editParticipantsCurrent);

  buildSearchableSelectControl("proj-responsavel");
  buildSearchableSelectControl("edit-proj-responsavel");
  buildSearchableSelectControl("proj-focal");
  buildSearchableSelectControl("edit-proj-focal");
  buildSearchableSelectControl("proj-participantes");
  buildSearchableSelectControl("edit-proj-participantes");
}

function refreshProcessStageSelects() {
  $$("#proc-etapas-container .proc-stage-item").forEach((row) => {
    const depSel = row.querySelector(".proc-etapa-departamento");
    const cargoSel = row.querySelector(".proc-etapa-cargo");
    const respSel = row.querySelector(".proc-etapa-responsavel");
    const depCurrent = depSel?.value || "";
    const cargoCurrent = cargoSel?.value || "";
    const respCurrent = respSel?.value || "";
    if (depSel) {
      depSel.innerHTML = `<option value="">Selecione...</option>${departamentosCache.map((d) => `<option value="${d.id}">${escapeHtml(d.nome)}</option>`).join("")}`;
      depSel.value = depCurrent;
    }
    if (cargoSel) {
      cargoSel.innerHTML = `<option value="">Selecione...</option>${cargosCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")}`;
      cargoSel.value = cargoCurrent;
    }
    if (respSel) {
      respSel.innerHTML = `<option value="">Selecione...</option>${usuariosCache.map((u) => `<option value="${u.id}">${escapeHtml(u.nome || u.email || "")}</option>`).join("")}`;
      respSel.value = respCurrent;
    }
  });
}

function getNextProcessStageOrder() {
  const values = $$("#proc-etapas-container .proc-etapa-ordem")
    .map((el) => Number(el.value || 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  const max = values.length ? Math.max(...values) : 0;
  return max + 1;
}

function updateProcessStageHeader(node) {
  if (!node) return;
  const order = Number(node.querySelector(".proc-etapa-ordem")?.value || 0) || 0;
  const name = (node.querySelector(".proc-etapa-nome")?.value || "").trim();
  const orderLabel = `#${order || "-"}`;
  const titleLabel = name || "Etapa sem nome";
  const badge = node.querySelector(".proc-stage-order-badge");
  const title = node.querySelector(".proc-stage-title");
  if (badge) badge.textContent = orderLabel;
  if (title) title.textContent = titleLabel;
}

function buildProcessStageRow(stage = {}) {
  const checklist = Array.isArray(stage?.conhecimento?.checklist) ? stage.conhecimento.checklist : [];
  const orderValue = Number(stage.ordem || 1);
  const stageName = String(stage.nome || "").trim() || "Etapa sem nome";
  return `
    <div class="row between center">
      <h4 class="proc-stage-heading"><span class="proc-stage-order-badge">#${orderValue}</span> <span class="proc-stage-title">${escapeHtml(stageName)}</span></h4>
      <div class="row gap">
        <button type="button" class="btn ghost btn-sm btn-proc-collapse-stage">Minimizar</button>
        <button type="button" class="btn ghost btn-sm btn-proc-remove-stage">Remover</button>
      </div>
    </div>
    <div class="proc-stage-body">
    <div class="grid two">
      <label>Nome da etapa<input class="proc-etapa-nome" type="text" value="${escapeHtml(stage.nome || "")}"></label>
      <label>Ordem<input class="proc-etapa-ordem" type="number" min="1" step="1" value="${Number(stage.ordem || 1)}"></label>
      <label>Departamento<select class="proc-etapa-departamento"></select></label>
      <label>Cargo<select class="proc-etapa-cargo"></select></label>
      <label>Responsável direto (opcional)<select class="proc-etapa-responsavel"></select></label>
      <label>SLA (opcional)<input class="proc-etapa-sla" type="text" value="${escapeHtml(stage.sla || "")}" placeholder="Ex.: 2 dias úteis"></label>
      <label>Tipo de entrada
        <select class="proc-etapa-tipo-entrada">
          <option value="manual">Manual</option>
          <option value="automatica">Automática</option>
          <option value="ambos">Ambos</option>
        </select>
      </label>
      <label>Status
        <select class="proc-etapa-status">
          <option value="ativa">Ativa</option>
          <option value="inativa">Inativa</option>
        </select>
      </label>
    </div>
    <label style="margin-top:8px;">Descrição detalhada<textarea class="proc-etapa-descricao" rows="2">${escapeHtml(stage.descricao || "")}</textarea></label>
    <h5 style="margin:10px 0 6px;">Repositório de conhecimento</h5>
    <label>Instruções da etapa<textarea class="proc-etapa-instrucoes" rows="2">${escapeHtml(stage?.conhecimento?.instrucoes || "")}</textarea></label>
    <label style="margin-top:8px;">Observações<textarea class="proc-etapa-observacoes" rows="2">${escapeHtml(stage?.conhecimento?.observacoes || "")}</textarea></label>
    <label style="margin-top:8px;">Pontos de atenção<textarea class="proc-etapa-pontos" rows="2">${escapeHtml(stage?.conhecimento?.pontos_atencao || "")}</textarea></label>
    <label style="margin-top:8px;">Checklist (uma linha por item)<textarea class="proc-etapa-checklist" rows="3">${escapeHtml(checklist.map((i) => i.texto).join("\n"))}</textarea></label>
    <label style="margin-top:8px;">Anexos da etapa<input class="proc-etapa-anexos" type="file" multiple></label>
    <div class="proc-comment-list"></div>
    <div class="row gap center" style="margin-top:8px;">
      <input class="proc-comment-input" type="text" placeholder="Adicionar comentário da etapa">
      <button type="button" class="btn ghost btn-sm btn-proc-add-comment">Adicionar</button>
    </div>
    </div>
  `;
}

function bindStageRowEvents(node) {
  node.querySelector(".btn-proc-remove-stage").addEventListener("click", () => node.remove());
  node.querySelector(".btn-proc-collapse-stage").addEventListener("click", (e) => {
    const body = node.querySelector(".proc-stage-body");
    const collapsed = body.classList.toggle("hidden");
    node.classList.toggle("is-collapsed", collapsed);
    e.currentTarget.textContent = collapsed ? "Expandir" : "Minimizar";
  });
  node.querySelector(".proc-etapa-nome")?.addEventListener("input", () => updateProcessStageHeader(node));
  node.querySelector(".proc-etapa-ordem")?.addEventListener("input", () => updateProcessStageHeader(node));
  node.querySelector(".btn-proc-add-comment").addEventListener("click", () => {
    const input = node.querySelector(".proc-comment-input");
    const value = input.value.trim();
    if (!value) return;
    const list = node.querySelector(".proc-comment-list");
    const item = document.createElement("div");
    const author = currentUser?.nome || currentUser?.username || "Usuário";
    item.className = "comment-item";
    item.dataset.id = crypto.randomUUID();
    item.innerHTML = `<header><strong>${escapeHtml(author)}</strong><span>${escapeHtml(new Date().toLocaleString("pt-BR"))}</span></header><p class="proc-comment-text">${escapeHtml(value)}</p><div class="row end"><button type="button" class="btn ghost btn-sm btn-proc-edit-comment">Editar</button></div>`;
    list.appendChild(item);
    item.querySelector(".btn-proc-edit-comment").addEventListener("click", () => {
      const current = item.querySelector(".proc-comment-text").textContent || "";
      const updated = prompt("Editar comentário", current);
      if (updated === null) return;
      item.querySelector(".proc-comment-text").textContent = updated;
      const history = JSON.parse(item.dataset.history || "[]");
      history.push({
        texto_anterior: current,
        editado_em: new Date().toISOString(),
        editado_por: author,
      });
      item.dataset.history = JSON.stringify(history);
    });
    input.value = "";
  });
}

function addProcessStage(stage = {}) {
  const container = $("proc-etapas-container");
  const stageData = { ...stage };
  if (!stageData.ordem) stageData.ordem = getNextProcessStageOrder();
  const node = document.createElement("div");
  node.className = "stage-item proc-stage-item";
  node.dataset.id = stageData.id || crypto.randomUUID();
  node.innerHTML = buildProcessStageRow(stageData);
  container.appendChild(node);
  const depSel = node.querySelector(".proc-etapa-departamento");
  const cargoSel = node.querySelector(".proc-etapa-cargo");
  const respSel = node.querySelector(".proc-etapa-responsavel");
  depSel.innerHTML = `<option value="">Selecione...</option>${departamentosCache.map((d) => `<option value="${d.id}">${escapeHtml(d.nome)}</option>`).join("")}`;
  cargoSel.innerHTML = `<option value="">Selecione...</option>${cargosCache.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")}`;
  respSel.innerHTML = `<option value="">Selecione...</option>${usuariosCache.map((u) => `<option value="${u.id}">${escapeHtml(u.nome || u.email || "")}</option>`).join("")}`;
  depSel.value = stageData.departamento_id || "";
  cargoSel.value = stageData.cargo_id || "";
  respSel.value = stageData.responsavel_id || "";
  node.querySelector(".proc-etapa-tipo-entrada").value = stageData.tipo_entrada || "manual";
  node.querySelector(".proc-etapa-status").value = stageData.status || "ativa";

  const list = node.querySelector(".proc-comment-list");
  const comments = Array.isArray(stageData?.conhecimento?.comentarios) ? stageData.conhecimento.comentarios : [];
  comments.forEach((c) => {
    const item = document.createElement("div");
    item.className = "comment-item";
    item.dataset.id = c.id || crypto.randomUUID();
    item.dataset.history = JSON.stringify(c.edit_history || []);
    item.innerHTML = `<header><strong>${escapeHtml(c.autor_nome || "Usuário")}</strong><span>${escapeHtml(c.data_hora ? new Date(c.data_hora).toLocaleString("pt-BR") : "-")}</span></header><p class="proc-comment-text">${escapeHtml(c.texto || "")}</p><div class="row end"><button type="button" class="btn ghost btn-sm btn-proc-edit-comment">Editar</button></div>`;
    list.appendChild(item);
    item.querySelector(".btn-proc-edit-comment").addEventListener("click", () => {
      const current = item.querySelector(".proc-comment-text").textContent || "";
      const updated = prompt("Editar comentário", current);
      if (updated === null) return;
      item.querySelector(".proc-comment-text").textContent = updated;
      const history = JSON.parse(item.dataset.history || "[]");
      history.push({
        texto_anterior: current,
        editado_em: new Date().toISOString(),
        editado_por: currentUser?.nome || currentUser?.username || "Usuário",
      });
      item.dataset.history = JSON.stringify(history);
    });
  });

  bindStageRowEvents(node);
  updateProcessStageHeader(node);
}

function collectProcessStages() {
  const rows = $$("#proc-etapas-container .proc-stage-item");
  return rows.map((row, idx) => {
    const checklist = (row.querySelector(".proc-etapa-checklist").value || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((texto) => ({ id: crypto.randomUUID(), texto, concluido: false }));
    const comments = Array.from(row.querySelectorAll(".proc-comment-list .comment-item")).map((item) => ({
      id: item.dataset.id || crypto.randomUUID(),
      autor_id: currentUser?.id || "",
      autor_nome: currentUser?.nome || currentUser?.username || "Usuário",
      data_hora: new Date().toISOString(),
      texto: item.querySelector(".proc-comment-text")?.textContent || "",
      edit_history: JSON.parse(item.dataset.history || "[]"),
    }));
    return {
      id: row.dataset.id || crypto.randomUUID(),
      nome: row.querySelector(".proc-etapa-nome").value.trim(),
      ordem: Number(row.querySelector(".proc-etapa-ordem").value || (idx + 1)),
      departamento_id: row.querySelector(".proc-etapa-departamento").value,
      cargo_id: row.querySelector(".proc-etapa-cargo").value,
      responsavel_id: row.querySelector(".proc-etapa-responsavel").value,
      descricao: row.querySelector(".proc-etapa-descricao").value.trim(),
      sla: row.querySelector(".proc-etapa-sla").value.trim(),
      tipo_entrada: row.querySelector(".proc-etapa-tipo-entrada").value,
      status: row.querySelector(".proc-etapa-status").value,
      conhecimento: {
        instrucoes: row.querySelector(".proc-etapa-instrucoes").value.trim(),
        observacoes: row.querySelector(".proc-etapa-observacoes").value.trim(),
        pontos_atencao: row.querySelector(".proc-etapa-pontos").value.trim(),
        checklist,
        anexos: fileListToMeta(row.querySelector(".proc-etapa-anexos").files),
        comentarios: comments,
      },
    };
  }).sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
}

function buildProcessPayload() {
  return {
    nome: $("proc-nome").value.trim(),
    departamento_id: $("proc-departamento").value,
    descricao: $("proc-descricao").value.trim(),
    status: $("proc-status").value,
    versao: $("proc-versao").value.trim() || "1.0",
    responsavel_id: $("proc-responsavel").value,
    etapas: collectProcessStages(),
  };
}

function renderProcessEditSearchOptions(processos = [], selectedId = "") {
  const select = $("proc-edit-select");
  if (!select) return;
  const rows = Array.isArray(processos) ? processos : [];
  select.innerHTML = `<option value="">Selecione um processo...</option>${rows
    .map((p) => `<option value="${escapeHtml(p.id || "")}">${escapeHtml(p.nome || "Processo sem nome")}</option>`)
    .join("")}`;
  if (selectedId) select.value = selectedId;
}

function updateProcessFormMode() {
  const saveBtn = $("btn-proc-save");
  const hint = $("proc-editing-hint");
  if (saveBtn) saveBtn.textContent = editingProcessId ? "Salvar alterações" : "Salvar processo";
  if (hint) {
    hint.textContent = editingProcessId
      ? "Modo edição ativo. As alterações serão aplicadas ao processo carregado."
      : "";
  }
}

async function searchProcessosForEdit() {
  const msg = $("proc-edit-msg");
  if (msg) msg.textContent = "";
  const nome = $("proc-edit-search")?.value?.trim() || "";
  const params = new URLSearchParams();
  if (nome) params.set("nome", nome);
  const data = await api(`/api/processos${params.toString() ? `?${params.toString()}` : ""}`);
  const processos = data.processos || [];
  renderProcessEditSearchOptions(processos);
  if (msg) {
    msg.style.color = "var(--muted)";
    msg.textContent = processos.length
      ? `${processos.length} processo(s) encontrado(s).`
      : "Nenhum processo encontrado para o filtro informado.";
  }
}

async function loadSelectedProcessForEdit() {
  const msg = $("proc-edit-msg");
  if (msg) msg.textContent = "";
  const processId = $("proc-edit-select")?.value || "";
  if (!processId) {
    if (msg) msg.textContent = "Selecione um processo para carregar.";
    return;
  }
  await openProcessForEdit(processId);
}

function clearProcessForm() {
  editingProcessId = "";
  $("proc-nome").value = "";
  $("proc-descricao").value = "";
  $("proc-status").value = "rascunho";
  $("proc-versao").value = "1.0";
  $("proc-departamento").value = "";
  $("proc-responsavel").value = "";
  $("proc-etapas-container").innerHTML = "";
  if ($("proc-edit-select")) $("proc-edit-select").value = "";
  if ($("proc-edit-msg")) $("proc-edit-msg").textContent = "";
  if ($("proc-msg")) $("proc-msg").textContent = "";
  addProcessStage();
  updateProcessFormMode();
}

async function loadDepartamentos() {
  const data = await api("/api/setores");
  departamentosCache = data.setores || [];
  renderSimpleOptions("usr-departamento", departamentosCache, "Selecione...");
  renderSimpleOptions("proc-departamento", departamentosCache, "Selecione...");
  renderSimpleOptions("proc-flt-departamento", departamentosCache, "Todos");
  refreshProcessStageSelects();
}

async function loadCargos() {
  const data = await api("/api/cargos");
  cargosCache = data.cargos || [];
  const body = $("cargos-body");
  if (body) {
    body.innerHTML = "";
    cargosCache.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(c.nome || "")}</td><td><button class="btn ghost btn-del-cargo" data-id="${c.id}">Excluir</button></td>`;
      body.appendChild(tr);
    });
    $$(".btn-del-cargo").forEach((btn) => btn.addEventListener("click", async () => {
      await api(`/api/cargos/${btn.dataset.id}`, { method: "DELETE" });
      await loadCargos();
      await loadUsers();
    }));
  }
  renderSimpleOptions("usr-cargo", cargosCache, "Selecione...");
  refreshProcessStageSelects();
}

async function addCargo() {
  $("cargo-msg").textContent = "";
  const nome = $("cargo-nome").value.trim();
  if (!nome) return void ($("cargo-msg").textContent = "Informe o nome do cargo.");
  try {
    await api("/api/cargos", { method: "POST", body: JSON.stringify({ nome }) });
    $("cargo-nome").value = "";
    await loadCargos();
  } catch (error) {
    $("cargo-msg").textContent = error.message;
  }
}

function populateProcessResponsibleSelect(users) {
  const options = (users || []).map((u) => ({ id: u.id, nome: u.nome || u.email || u.username || "Usuário" }));
  renderSimpleOptions("proc-responsavel", options, "Selecione...");
}

function renderProcessList(processos) {
  const wrap = $("proc-groups-wrap");
  if (!wrap) return;
  wrap.innerHTML = "";

  const grouped = {};
  (processos || []).forEach((p) => {
    const dept = p.departamento_nome || "Sem setor";
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(p);
  });
  const deptNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (!deptNames.length) {
    wrap.innerHTML = `<p class="resume-text">Nenhum processo encontrado para os filtros informados.</p>`;
    return;
  }

  deptNames.forEach((dept) => {
    const deptId = `dept-${dept.toLowerCase().replaceAll(" ", "-")}`;
    const deptOpen = processoDeptExpanded.has(deptId);
    const container = document.createElement("article");
    container.className = "proc-group";
    container.innerHTML = `
      <header class="proc-group-header">
        <button class="btn ghost btn-sm btn-proc-toggle-dept" data-id="${escapeHtml(deptId)}">${deptOpen ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT}</button>
        <h4>${escapeHtml(dept)}</h4>
        <span class="proc-group-count">${grouped[dept].length} processos</span>
      </header>
      <div class="proc-group-body ${deptOpen ? "" : "hidden"}"></div>
    `;
    wrap.appendChild(container);
    const body = container.querySelector(".proc-group-body");
    grouped[dept]
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
      .forEach((p) => {
        const procOpen = processoItemExpanded.has(p.id);
        const stagesCollapsed = processoItemStagesCollapsed.has(p.id);
        const etapas = Array.isArray(p.etapas) ? [...p.etapas].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)) : [];
        const item = document.createElement("div");
        item.className = "proc-item";
        item.innerHTML = `
          <div class="proc-item-header">
            <button class="btn ghost btn-sm btn-proc-toggle-item" data-id="${p.id}">${procOpen ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT}</button>
            <div class="proc-item-main">
              <strong>${escapeHtml(p.nome || "")}</strong>
              <span>${escapeHtml(statusLabel(p.status || ""))}</span>
              <span>Versão ${escapeHtml(p.versao || "1.0")}</span>
              <span>${escapeHtml(p.responsavel_nome || "-")}</span>
            </div>
            <div class="row gap">
              <button class="btn ghost btn-sm btn-proc-edit" data-id="${p.id}">Editar</button>
              <button class="btn ghost btn-sm btn-proc-subprocess" data-id="${p.id}">Processo Subsequente</button>
              <button class="btn ghost btn-sm btn-proc-subetapa" data-id="${p.id}">Etapa Subsequente</button>
              <button class="btn ghost btn-sm btn-proc-inativar" data-id="${p.id}">Inativar</button>
            </div>
          </div>
          <div class="proc-item-body ${procOpen ? "" : "hidden"}">
            <p><strong>Descrição:</strong> ${escapeHtml(p.descricao || "-")}</p>
            <p><strong>Atualização:</strong> ${escapeHtml(p.ultima_atualizacao ? new Date(p.ultima_atualizacao).toLocaleString("pt-BR") : "-")}</p>
            <div class="row between center" style="margin-top:8px;">
              <h5>Etapas (${etapas.length})</h5>
              <button class="btn ghost btn-sm btn-proc-toggle-stages" data-id="${p.id}">${stagesCollapsed ? "Expandir etapas" : "Minimizar etapas"}</button>
            </div>
            <ul class="${stagesCollapsed ? "hidden" : ""}">${etapas.map((e) => `<li><strong>#${Number(e.ordem || 0)}</strong> ${escapeHtml(e.nome || "Etapa")} - ${escapeHtml(statusLabel(e.status || ""))} - ${escapeHtml(e.responsavel_nome || "Sem responsável")}</li>`).join("") || "<li>Sem etapas</li>"}</ul>
          </div>
        `;
        body.appendChild(item);
      });
  });

  $$(".btn-proc-toggle-dept").forEach((btn) => btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    if (processoDeptExpanded.has(id)) processoDeptExpanded.delete(id);
    else processoDeptExpanded.add(id);
    renderProcessList(processosCache);
  }));
  $$(".btn-proc-toggle-item").forEach((btn) => btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    if (processoItemExpanded.has(id)) processoItemExpanded.delete(id);
    else processoItemExpanded.add(id);
    renderProcessList(processosCache);
  }));
  $$(".btn-proc-toggle-stages").forEach((btn) => btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    if (processoItemStagesCollapsed.has(id)) processoItemStagesCollapsed.delete(id);
    else processoItemStagesCollapsed.add(id);
    renderProcessList(processosCache);
  }));
  $$(".btn-proc-edit").forEach((btn) => btn.addEventListener("click", () => openProcessForEdit(btn.dataset.id)));
  $$(".btn-proc-inativar").forEach((btn) => btn.addEventListener("click", async () => {
    await api(`/api/processos/${btn.dataset.id}/inativar`, { method: "POST" });
    await loadProcessos();
  }));
  $$(".btn-proc-subprocess").forEach((btn) => btn.addEventListener("click", async () => {
    const parent = processosCache.find((p) => p.id === btn.dataset.id);
    if (!parent) return;
    setActiveView("view-processos-cadastro");
    editingProcessId = "";
    $("proc-nome").value = `${parent.nome || ""} - Continuação`;
    $("proc-departamento").value = parent.departamento_id || "";
    $("proc-descricao").value = `Processo subsequente de: ${parent.nome || ""}\n${parent.descricao || ""}`.trim();
    $("proc-status").value = "rascunho";
    $("proc-versao").value = String(Number(parent.versao || "1.0") + 0.1).replace(",", ".");
    $("proc-responsavel").value = parent.responsavel_id || "";
    $("proc-etapas-container").innerHTML = "";
    addProcessStage();
  }));
  $$(".btn-proc-subetapa").forEach((btn) => btn.addEventListener("click", async () => {
    const data = await api(`/api/processos/${btn.dataset.id}`);
    const p = data.processo;
    setActiveView("view-processos-cadastro");
    await openProcessForEdit(p.id);
    const nextOrder = (Array.isArray(p.etapas) ? p.etapas.length : 0) + 1;
    addProcessStage({
      ordem: nextOrder,
      departamento_id: p.departamento_id || "",
      responsavel_id: p.responsavel_id || "",
      status: "ativa",
      tipo_entrada: "manual",
      nome: `Etapa ${nextOrder}`,
    });
  }));
  renderProcessFlow(processos);
}

function setProcessConsultaView(mode) {
  processConsultaViewMode = mode === "flow" ? "flow" : "list";
  $("proc-view-list-card")?.classList.toggle("hidden", processConsultaViewMode !== "list");
  $("proc-view-flow-card")?.classList.toggle("hidden", processConsultaViewMode !== "flow");
  $("btn-proc-view-list")?.classList.toggle("active-log", processConsultaViewMode === "list");
  $("btn-proc-view-flow")?.classList.toggle("active-log", processConsultaViewMode === "flow");
}

function showProcessStageModal(processo, etapa) {
  const conhecimento = etapa.conhecimento || {};
  const checklist = Array.isArray(conhecimento.checklist) ? conhecimento.checklist : [];
  const anexos = Array.isArray(conhecimento.anexos) ? conhecimento.anexos : [];
  const comentarios = Array.isArray(conhecimento.comentarios) ? conhecimento.comentarios : [];
  $("process-stage-modal-title").textContent = `${processo.nome || "Processo"} - ${etapa.nome || "Etapa"}`;
  $("process-stage-modal-body").innerHTML = `
    <div class="details-grid">
      <p><strong>Ordem:</strong> ${Number(etapa.ordem || 0)}</p>
      <p><strong>Status:</strong> ${escapeHtml(statusLabel(etapa.status || ""))}</p>
      <p><strong>Tipo de entrada:</strong> ${escapeHtml(statusLabel(etapa.tipo_entrada || ""))}</p>
      <p><strong>Responsável:</strong> ${escapeHtml(etapa.responsavel_nome || "Não definido")}</p>
      <p><strong>Cargo:</strong> ${escapeHtml(etapa.cargo_nome || "Não definido")}</p>
      <p><strong>SLA:</strong> ${escapeHtml(etapa.sla || "Não definido")}</p>
      <p><strong>Descrição:</strong> ${escapeHtml(etapa.descricao || "-")}</p>
      <p><strong>Instruções:</strong> ${escapeHtml(conhecimento.instrucoes || "-")}</p>
      <p><strong>Observações:</strong> ${escapeHtml(conhecimento.observacoes || "-")}</p>
      <p><strong>Pontos de atenção:</strong> ${escapeHtml(conhecimento.pontos_atencao || "-")}</p>
    </div>
    <h4 style="margin-top:10px;">Checklist</h4>
    <ul>${checklist.map((c) => `<li>${escapeHtml(c.texto || "")}${c.concluido ? " (Concluído)" : ""}</li>`).join("") || "<li>Sem itens</li>"}</ul>
    <h4 style="margin-top:10px;">Anexos</h4>
    <ul>${anexos.map((a) => `<li>${escapeHtml(a.nome || "Arquivo")} - ${escapeHtml(a.tipo || "tipo não informado")}</li>`).join("") || "<li>Sem anexos</li>"}</ul>
    <h4 style="margin-top:10px;">Comentários</h4>
    <div class="comment-list">
      ${comentarios.map((c) => `<article class="comment-item"><header><strong>${escapeHtml(c.autor_nome || "Usuário")}</strong><span>${escapeHtml(c.data_hora ? new Date(c.data_hora).toLocaleString("pt-BR") : "-")}</span></header><p>${escapeHtml(c.texto || "")}</p></article>`).join("") || `<p class="resume-text">Sem comentários.</p>`}
    </div>
  `;
  $("process-stage-modal").classList.remove("hidden");
}

function showProcessFullModal(processo) {
  const etapas = Array.isArray(processo?.etapas) ? [...processo.etapas].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)) : [];
  const etapasHtml = etapas.map((e, idx) => {
    const conhecimento = e.conhecimento || {};
    const anexos = Array.isArray(conhecimento.anexos) ? conhecimento.anexos : [];
    const anexosHtml = anexos.length
      ? `<ul>${anexos.map((a) => `<li>${escapeHtml(a.nome || "Arquivo")} (${escapeHtml(a.tipo || "-")})</li>`).join("")}</ul>`
      : `<p class="resume-text">Sem anexos nesta etapa.</p>`;
    return `
      <article class="proc-stage-item" style="margin-top:10px;">
        <h4 class="proc-stage-heading"><span class="proc-stage-order-badge">#${Number(e.ordem || (idx + 1))}</span> <span class="proc-stage-title">${escapeHtml(e.nome || "Etapa")}</span></h4>
        <div class="details-grid" style="margin-top:8px;">
          <p><strong>Status:</strong> ${escapeHtml(statusLabel(e.status || ""))}</p>
          <p><strong>Responsável:</strong> ${escapeHtml(e.responsavel_nome || "Não definido")}</p>
          <p><strong>Cargo:</strong> ${escapeHtml(e.cargo_nome || "Não definido")}</p>
          <p><strong>SLA:</strong> ${escapeHtml(e.sla || "Não definido")}</p>
          <p><strong>Descrição:</strong> ${escapeHtml(e.descricao || "-")}</p>
        </div>
        <h5 style="margin-top:8px;">Anexos da etapa</h5>
        ${anexosHtml}
      </article>
    `;
  }).join("");

  $("process-stage-modal-title").textContent = `Íntegra do Processo: ${processo?.nome || "Processo"}`;
  $("process-stage-modal-body").innerHTML = `
    <div class="details-grid">
      <p><strong>Setor:</strong> ${escapeHtml(processo?.departamento_nome || "Não informado")}</p>
      <p><strong>Status:</strong> ${escapeHtml(statusLabel(processo?.status || ""))}</p>
      <p><strong>Versão:</strong> ${escapeHtml(processo?.versao || "1.0")}</p>
      <p><strong>Responsável:</strong> ${escapeHtml(processo?.responsavel_nome || "Não informado")}</p>
      <p><strong>Descrição:</strong> ${escapeHtml(processo?.descricao || "-")}</p>
    </div>
    <h4 style="margin-top:12px;">Etapas e arquivos</h4>
    ${etapasHtml || "<p class='resume-text'>Sem etapas cadastradas.</p>"}
  `;
  $("process-stage-modal").classList.remove("hidden");
}

function renderProcessFlow(processos) {
  const wrap = $("proc-flow-wrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  const rows = (processos || []).slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  if (!rows.length) {
    wrap.innerHTML = `<p class="resume-text">Nenhum processo disponível para esteira visual.</p>`;
    return;
  }
  const grouped = {};
  rows.forEach((p) => {
    const dept = p.departamento_nome || "Sem setor";
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(p);
  });
  Object.keys(grouped).sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((dept) => {
    const groupNode = document.createElement("section");
    groupNode.className = "proc-flow-dept-group";
    groupNode.innerHTML = `<h4 class="proc-flow-dept-title">${escapeHtml(dept)}</h4><div class="proc-flow-dept-lanes"></div>`;
    const lanesWrap = groupNode.querySelector(".proc-flow-dept-lanes");
    grouped[dept].forEach((p) => {
      const etapas = Array.isArray(p.etapas) ? [...p.etapas].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)) : [];
      const lane = document.createElement("article");
      lane.className = "proc-flow-lane";
      lane.innerHTML = `
        <header class="proc-flow-lane-header">
          <strong>${escapeHtml(p.nome || "")}</strong>
          <span>${escapeHtml(statusLabel(p.status || ""))}</span>
          <span>Versão ${escapeHtml(p.versao || "1.0")}</span>
          <button type="button" class="btn ghost btn-sm btn-proc-flow-open" data-id="${p.id}">Ver íntegra</button>
        </header>
        <div class="proc-flow-track"></div>
      `;      const track = lane.querySelector(".proc-flow-track");
      if (!etapas.length) {
        const empty = document.createElement("p");
        empty.className = "resume-text";
        empty.textContent = "Processo sem etapas cadastradas.";
        track.appendChild(empty);
      } else {
        etapas.forEach((e, idx) => {
          const stage = document.createElement("article");
          stage.className = "proc-flow-stage";
          stage.dataset.processoId = p.id;
          stage.dataset.etapaId = e.id;
          stage.innerHTML = `
            <h5>#${Number(e.ordem || (idx + 1))} ${escapeHtml(e.nome || "Etapa")}</h5>
            <p><strong>Status:</strong> ${escapeHtml(statusLabel(e.status || ""))}</p>
            <p><strong>Responsável:</strong> ${escapeHtml(e.responsavel_nome || "Não definido")}</p>
            <p><strong>Tipo:</strong> ${escapeHtml(statusLabel(e.tipo_entrada || ""))}</p>
          `;
          track.appendChild(stage);
          if (idx < etapas.length - 1) {
            const arrow = document.createElement("div");
            arrow.className = "proc-flow-arrow";
            arrow.textContent = ICON_ARROW_RIGHT;
            track.appendChild(arrow);
          }
        });
      }
      lanesWrap.appendChild(lane);
    });
    wrap.appendChild(groupNode);
  });

  $$(".proc-flow-stage").forEach((card) => card.addEventListener("click", () => {
    const processo = (processosCache || []).find((p) => p.id === card.dataset.processoId);
    if (!processo) return;
    const etapa = (processo.etapas || []).find((e) => e.id === card.dataset.etapaId);
    if (!etapa) return;
    showProcessStageModal(processo, etapa);
  }));
  $$(".btn-proc-flow-open").forEach((btn) => btn.addEventListener("click", () => {
    const processo = (processosCache || []).find((p) => p.id === btn.dataset.id);
    if (!processo) return;
    showProcessFullModal(processo);
  }));
}

async function loadProcessos() {
  const params = new URLSearchParams();
  const nome = $("proc-flt-nome")?.value?.trim() || "";
  const departamentoIds = getMultiFilterValues("proc-flt-departamento");
  const statuses = getMultiFilterValues("proc-flt-status");
  if (nome) params.set("nome", nome);
  if (departamentoIds.length === 1) params.set("departamento_id", departamentoIds[0]);
  if (statuses.length === 1) params.set("status", statuses[0]);
  const qs = params.toString();
  const data = await api(`/api/processos${qs ? `?${qs}` : ""}`);
  let processos = data.processos || [];
  if (departamentoIds.length > 1) {
    const allowedDept = new Set(departamentoIds);
    processos = processos.filter((p) => allowedDept.has(String(p.departamento_id || "")));
  }
  if (statuses.length > 1) {
    const allowedStatus = new Set(statuses);
    processos = processos.filter((p) => allowedStatus.has(String(p.status || "")));
  }
  processosCache = processos;
  renderProcessEditSearchOptions(processosCache, editingProcessId);
  renderProcessList(processosCache);
  if (processConsultaViewMode === "flow") renderProcessFlow(processosCache);
}

async function openProcessForEdit(id) {
  const data = await api(`/api/processos/${id}`);
  const p = data.processo;
  setActiveView("view-processos-cadastro");
  editingProcessId = p.id;
  $("proc-nome").value = p.nome || "";
  $("proc-departamento").value = p.departamento_id || "";
  $("proc-status").value = p.status || "rascunho";
  $("proc-versao").value = p.versao || "1.0";
  $("proc-responsavel").value = p.responsavel_id || "";
  $("proc-descricao").value = p.descricao || "";
  $("proc-etapas-container").innerHTML = "";
  (p.etapas || []).forEach((s) => addProcessStage(s));
  if (!(p.etapas || []).length) addProcessStage();
  if ($("proc-edit-select")) $("proc-edit-select").value = p.id || "";
  if ($("proc-edit-search")) $("proc-edit-search").value = p.nome || "";
  if ($("proc-edit-msg")) {
    $("proc-edit-msg").style.color = "green";
    $("proc-edit-msg").textContent = `Processo carregado para edição: ${p.nome || "Processo"}`;
  }
  updateProcessFormMode();
}

async function saveProcesso() {
  $("proc-msg").textContent = "";
  try {
    const payload = buildProcessPayload();
    if (editingProcessId) {
      await api(`/api/processos/${editingProcessId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/processos", { method: "POST", body: JSON.stringify(payload) });
    }
    $("proc-msg").style.color = "green";
    $("proc-msg").textContent = "Processo salvo com sucesso.";
    await loadProcessos();
    clearProcessForm();
  } catch (error) {
    $("proc-msg").style.color = "var(--danger)";
    $("proc-msg").textContent = error.message;
  }
}

function renderRoleOptions(selectId, roles, selected = "") {
  const sel = $(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecione...</option>${(roles || []).map((r) => `<option value="${r.id}">${escapeHtml(r.nome)}</option>`).join("")}`;
  if (selected) sel.value = selected;
}

async function loadRoles() {
  const data = await api("/api/roles");
  const roles = data.roles || [];
  renderRoleOptions("usr-role", roles);

  const permWrap = $("role-perms");
  const availableViews = data.available_views || [];
  const groups = [
    { key: "processos", title: "Módulo Processos", match: (v) => String(v).startsWith("view-processos-") },
    { key: "projetos", title: "Módulo Projetos", match: (v) => String(v).startsWith("view-projetos-") },
    { key: "cadastros", title: "Módulo Cadastros", match: (v) => String(v).startsWith("view-cadastros-") },
    { key: "outros", title: "Outros", match: () => true },
  ];
  const groupedViews = {};
  groups.forEach((g) => { groupedViews[g.key] = []; });
  availableViews.forEach((view) => {
    const group = groups.find((g) => g.key !== "outros" && g.match(view)) || groups.find((g) => g.key === "outros");
    groupedViews[group.key].push(view);
  });
  permWrap.innerHTML = groups
    .filter((g) => (groupedViews[g.key] || []).length > 0)
    .map((g) => `
      <section class="role-perm-group">
        <h5 class="role-perm-title">${escapeHtml(g.title)}</h5>
        <div class="role-perm-list">
          ${(groupedViews[g.key] || [])
            .map((v) => `<label class="perm-option"><input type="checkbox" class="role-perm" value="${v}"><span>${escapeHtml(viewLabel(v))}</span></label>`)
            .join("")}
        </div>
      </section>
    `)
    .join("");

  const body = $("roles-body");
  body.innerHTML = "";
  roles.forEach((r) => {
    const tr = document.createElement("tr");
    const perms = (r.permissions || []).includes("*")
      ? "Acesso total"
      : (r.permissions || []).map((p) => viewLabel(p)).join(", ");
    const editBtn = r.nome === "Administrador"
      ? `<button class="btn ghost btn-sm" disabled>Administrador protegido</button>`
      : `<button class="btn ghost btn-sm btn-edit-role" data-id="${r.id}">${ICON_EDIT} Editar</button>`;
    tr.innerHTML = `<td>${escapeHtml(r.nome)}</td><td>${escapeHtml(perms || "-")}</td><td><div class="actions-wrap">${editBtn}</div></td>`;
    body.appendChild(tr);
  });
  $$(".btn-edit-role").forEach((btn) => btn.addEventListener("click", () => {
    const role = roles.find((item) => String(item.id || "") === String(btn.dataset.id || ""));
    if (!role) return;
    editingRoleId = String(role.id || "");
    $("role-nome").value = role.nome || "";
    $$(".role-perm").forEach((checkbox) => {
      checkbox.checked = (role.permissions || []).includes(checkbox.value);
    });
    $("btn-add-role").textContent = "Salvar alterações";
    $("btn-cancel-role-edit").classList.remove("hidden");
    $("role-msg").style.color = "var(--muted)";
    $("role-msg").textContent = `Editando papel: ${role.nome || "Papel"}`;
    $("role-nome").focus();
  }));
}

function clearRoleForm() {
  editingRoleId = "";
  $("role-nome").value = "";
  $$(".role-perm").forEach((checkbox) => {
    checkbox.checked = false;
  });
  $("btn-add-role").textContent = "Cadastrar papel";
  $("btn-cancel-role-edit").classList.add("hidden");
}

async function saveRole() {
  $("role-msg").textContent = "";
  try {
    const nome = $("role-nome").value.trim();
    const permissions = $$(".role-perm").filter((e) => e.checked).map((e) => e.value);
    const isEditing = !!editingRoleId;
    await api(isEditing ? `/api/roles/${editingRoleId}` : "/api/roles", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify({ nome, permissions }),
    });
    clearRoleForm();
    await loadRoles();
    $("role-msg").style.color = "green";
    $("role-msg").textContent = isEditing ? "Papel atualizado com sucesso." : "Papel cadastrado com sucesso.";
  } catch (error) {
    $("role-msg").style.color = "var(--danger)";
    $("role-msg").textContent = error.message;
  }
}

async function loadUsers() {
  const loginAccessValues = getMultiFilterValues("usr-filter-login");
  const loginAccess = loginAccessValues.length === 1 ? loginAccessValues[0] : "";
  const qs = loginAccess ? `?login_access=${encodeURIComponent(loginAccess)}` : "";
  const canLoadRoles = hasPermission("view-cadastros-perfis") || hasPermission("view-cadastros-usuarios");
  const [usersRes, rolesRes] = await Promise.all([
    api(`/api/users${qs}`),
    canLoadRoles ? api("/api/roles") : Promise.resolve({ roles: [] }),
  ]);
  const users = usersRes.users || [];
  usuariosCache = users;
  const roles = rolesRes.roles || [];
  const body = $("users-body");
  if (!body) {
    refreshProjectStageResponsavelSelects();
    return;
  }
  body.innerHTML = "";
  users.forEach((u) => {
    const tr = document.createElement("tr");
    const roleSelect = u.has_login
      ? `<select class="usr-role-sel" data-id="${u.id}">${roles.map((r) => `<option value="${r.id}" ${u.role_id === r.id ? "selected" : ""}>${escapeHtml(r.nome)}</option>`).join("")}</select>`
      : `<span>-</span>`;
    const resetBtn = u.has_login
      ? `<button class="btn ghost btn-sm btn-reset-user" data-id="${u.id}">Resetar senha</button>`
      : `<button class="btn ghost btn-sm" disabled>Sem login</button>`;
    const editBtn = `<button class="btn ghost btn-sm btn-edit-user" data-id="${u.id}">${ICON_EDIT} Editar</button>`;
    const isAdmin = String(u.username || "").toLowerCase() === "admin";
    const isCurrentUser = String(currentUser?.id || "") === String(u.id || "");
    const deleteBtn = isAdmin
      ? `<button class="btn ghost btn-sm" disabled>Admin protegido</button>`
      : isCurrentUser
        ? `<button class="btn ghost btn-sm" disabled>Usuário atual</button>`
        : `<button class="btn ghost btn-sm btn-del-user" data-id="${u.id}">${ICON_TRASH} Excluir</button>`;
    tr.innerHTML = `<td>${escapeHtml(u.nome || "")}</td><td>${escapeHtml(u.email || "")}</td><td>${escapeHtml(u.username || "-")}</td><td>${escapeHtml(u.departamento_nome || "-")}</td><td>${escapeHtml(u.cargo_nome || "-")}</td><td>${u.has_login ? "Sim" : "Não"}</td><td>${roleSelect}</td><td>${u.must_change_password ? "Sim" : "Não"}</td><td><div class="actions-wrap">${editBtn}${resetBtn}${deleteBtn}</div></td>`;
    body.appendChild(tr);
  });
  updateResponsavelSelects();
  renderProjectUserSelects();
  refreshProjectStageResponsavelSelects();
  populateProcessResponsibleSelect(users);
  refreshProcessStageSelects();

  $$(".usr-role-sel").forEach((sel) => sel.addEventListener("change", async () => {
    await api(`/api/users/${sel.dataset.id}/role`, { method: "PUT", body: JSON.stringify({ role_id: sel.value }) });
  }));
  $$(".btn-reset-user").forEach((btn) => btn.addEventListener("click", async () => {
    const data = await api(`/api/users/${btn.dataset.id}/reset-password`, { method: "POST" });
    showTemporaryPassword("usr-msg", data.temp_password, data.temp_password_expires_at || "");
    await loadUsers();
  }));
  $$(".btn-del-user").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("Deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;
    try {
      const data = await api(`/api/users/${btn.dataset.id}`, { method: "DELETE" });
      const cleanup = data.cleanup || {};
      const detalhes = [];
      if (Number(cleanup.processos_alterados || 0) > 0) detalhes.push(`${cleanup.processos_alterados} processo(s) atualizados`);
      if (Number(cleanup.etapas_processo_alteradas || 0) > 0) detalhes.push(`${cleanup.etapas_processo_alteradas} etapa(s) de processo atualizadas`);
      if (Number(cleanup.projetos_alterados || 0) > 0) detalhes.push(`${cleanup.projetos_alterados} projeto(s) atualizados`);
      if (Number(cleanup.participantes_removidos || 0) > 0) detalhes.push(`${cleanup.participantes_removidos} vínculo(s) de participante removido(s)`);
      $("usr-msg").style.color = "green";
      $("usr-msg").textContent = detalhes.length
        ? `Usuário excluído com sucesso. Ajustes automáticos: ${detalhes.join(", ")}.`
        : "Usuário excluído com sucesso.";
      await loadUsers();
    } catch (error) {
      $("usr-msg").style.color = "var(--danger)";
      $("usr-msg").textContent = error.message;
    }
  }));
  $$(".btn-edit-user").forEach((btn) => btn.addEventListener("click", () => {
    const user = users.find((item) => String(item.id || "") === String(btn.dataset.id || ""));
    if (!user) return;
    editingUserId = String(user.id || "");
    $("usr-nome").value = user.nome || "";
    $("usr-email").value = user.email || "";
    $("usr-departamento").value = user.departamento_id || "";
    $("usr-cargo").value = user.cargo_id || "";
    $("usr-has-login").value = user.has_login ? "sim" : "nao";
    $("usr-role").value = user.role_id || "";
    $("usr-role").disabled = !user.has_login;
    $("btn-add-user").textContent = "Salvar alterações";
    $("btn-cancel-user-edit").classList.remove("hidden");
    $("usr-msg").style.color = "var(--muted)";
    $("usr-msg").textContent = `Editando usuário: ${user.nome || user.email || "Usuário"}`;
    $("usr-nome").focus();
  }));
}

function clearUserForm() {
  editingUserId = "";
  $("usr-nome").value = "";
  $("usr-email").value = "";
  $("usr-departamento").value = "";
  $("usr-cargo").value = "";
  $("usr-has-login").value = "sim";
  $("usr-role").value = "";
  $("usr-role").disabled = false;
  $("btn-add-user").textContent = "Cadastrar usuário";
  $("btn-cancel-user-edit").classList.add("hidden");
}

async function saveUser() {
  $("usr-msg").textContent = "";
  try {
    const payload = {
      nome: $("usr-nome").value.trim(),
      email: $("usr-email").value.trim(),
      departamento_id: $("usr-departamento").value,
      cargo_id: $("usr-cargo").value,
      has_login: $("usr-has-login").value === "sim",
      role_id: $("usr-role").value,
    };
    const isEditing = !!editingUserId;
    const data = await api(isEditing ? `/api/users/${editingUserId}` : "/api/users", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    if (payload.has_login) {
      if (data.temp_password) {
        showTemporaryPassword("usr-msg", data.temp_password, data.temp_password_expires_at || "");
      } else {
        $("usr-msg").style.color = "green";
        $("usr-msg").textContent = isEditing ? "Usuário atualizado com sucesso." : "Usuário cadastrado com sucesso.";
      }
    } else {
      $("usr-msg").style.color = "green";
      $("usr-msg").textContent = isEditing
        ? "Usuário atualizado sem acesso ao sistema."
        : "Usuário cadastrado sem acesso ao sistema.";
    }
    clearUserForm();
    await loadUsers();
  } catch (error) {
    $("usr-msg").style.color = "var(--danger)";
    $("usr-msg").textContent = error.message;
  }
}

function renderPriorizacao(result) {
  lastPriorizacaoResult = result;
  $("prio-score-final").textContent = result.score_final;
  $("prio-prioridade").textContent = result.prioridade;
  $("prio-payback").textContent = result.payback_meses;
  $("prio-custo-hora").textContent = formatCurrencyBRL(result.custo_hora);
  $("prio-cp-anual").textContent = formatCurrencyBRL(result.cp_anual);
  $("prio-economia-mensal").textContent = formatCurrencyBRL(result.economia_mensal);
  $("prio-cp-score").textContent = result.cp_score;
  $("prio-pb-score").textContent = result.pb_score;
  const input = lastPriorizacaoInput || {};
  $("prio-preview").innerHTML = `<h4>Relatório de Priorização</h4><p><strong>Responsável:</strong> ${escapeHtml(input.responsavel || "Não informado")}</p><p><strong>Cargo:</strong> ${escapeHtml(input.cargo || "Não informado")}</p><p><strong>Resumo do processo:</strong> ${escapeHtml(input.resumo_processo || "Não informado")}</p><h4>Resultados</h4><p><strong>Score final:</strong> ${result.score_final}</p><p><strong>Prioridade:</strong> ${escapeHtml(result.prioridade)}</p><p><strong>Payback (meses):</strong> ${result.payback_meses}</p>`;
}

function gatherPriorizacaoInput() {
  return {
    responsavel: $("prio-responsavel").value.trim(),
    cargo: $("prio-cargo").value.trim(),
    resumo_processo: $("prio-resumo-processo").value.trim(),
    qtd_pessoas: Number($("prio-qtd-pessoas").value || 0),
    horas_mensais: Number($("prio-horas-mensais").value || 0),
    custo_mensal: parseCurrencyBRL($("prio-custo-mensal").value),
    custo_desenvolvimento: parseCurrencyBRL($("prio-custo-desenvolvimento").value),
    complexidade: Number($("prio-complexidade").value || 0),
    dev_interno: Number($("prio-dev-interno").value || 0),
  };
}

async function calculatePriorizacao() {
  $("prio-error").textContent = "";
  try {
    lastPriorizacaoInput = gatherPriorizacaoInput();
    const data = await api("/api/priorizacao/calculate", { method: "POST", body: JSON.stringify(lastPriorizacaoInput) });
    renderPriorizacao(data.result);
  } catch (error) {
    $("prio-error").textContent = error.message;
  }
}

async function downloadPriorizacaoWord() {
  if (!lastPriorizacaoInput) return void ($("prio-error").textContent = "Calcule a priorização antes de exportar.");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const response = await fetch("/api/priorizacao/export/word", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(lastPriorizacaoInput),
  });
  if (!response.ok) return void ($("prio-error").textContent = "Falha ao gerar Word.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Relatorio_Priorizacao.docx";
  a.click();
  URL.revokeObjectURL(url);
}

function pesosLabel(metodologia = {}, key = "") {
  const value = metodologia?.premissas?.pesos?.[key];
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
}

function downloadPriorizacaoPdf() {
  if (!lastPriorizacaoInput || !lastPriorizacaoResult) {
    $("prio-error").textContent = "Calcule a priorização antes de exportar.";
    return;
  }
  const jspdfNs = window.jspdf;
  if (!jspdfNs || !jspdfNs.jsPDF) {
    $("prio-error").textContent = "Biblioteca de PDF não carregada.";
    return;
  }
  const { jsPDF } = jspdfNs;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 34;
  let y = margin;
  const leftX = margin;
  const rightX = pageW / 2 + 8;
  const colW = pageW / 2 - margin - 12;
  const metodologia = lastPriorizacaoResult.metodologia || {};
  const compactRowsLeft = [
    ["Responsável", lastPriorizacaoInput.responsavel || "Não informado"],
    ["Cargo", lastPriorizacaoInput.cargo || "Não informado"],
    ["Qtd Pessoas", String(lastPriorizacaoInput.qtd_pessoas ?? "-")],
    ["Horas Mensais", String(lastPriorizacaoInput.horas_mensais ?? "-")],
    ["Custo Mensal", `R$ ${lastPriorizacaoInput.custo_mensal ?? "-"}`],
    ["Custo Desenvolv.", `R$ ${lastPriorizacaoInput.custo_desenvolvimento ?? "-"}`],
    ["Complexidade", String(lastPriorizacaoInput.complexidade ?? "-")],
    ["Dev. Interno", String(lastPriorizacaoInput.dev_interno ?? "-")],
  ];
  const compactRowsRight = [
    ["Custo Hora", formatCurrencyBRL(lastPriorizacaoResult.custo_hora)],
    ["CP Anual", formatCurrencyBRL(lastPriorizacaoResult.cp_anual)],
    ["Economia Mensal", formatCurrencyBRL(lastPriorizacaoResult.economia_mensal)],
    ["Payback", String(lastPriorizacaoResult.payback_meses ?? "-")],
    ["CP Score", String(lastPriorizacaoResult.cp_score ?? "-")],
    ["PB Score", String(lastPriorizacaoResult.pb_score ?? "-")],
    ["Score Final", String(lastPriorizacaoResult.score_final ?? "-")],
    ["Prioridade", String(lastPriorizacaoResult.prioridade || "-")],
  ];

  const drawCompactTable = (rows, startX, startY, width) => {
    let rowY = startY;
    rows.forEach(([label, value]) => {
      doc.setDrawColor(217, 226, 236);
      doc.setFillColor(255, 255, 255);
      doc.rect(startX, rowY, 92, 22, "FD");
      doc.rect(startX + 92, rowY, width - 92, 22, "FD");
      doc.setTextColor(...PDF_TITLE_RGB);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(label, startX + 6, rowY + 14);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(String(value || "-"), width - 104), startX + 98, rowY + 14);
      rowY += 22;
    });
    return rowY;
  };

  drawPdfHeader(doc, {
    title: "Relatório de Priorização",
    subtitle: `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    margin,
    y,
    pageW,
  });
  y += 82;

  doc.setTextColor(...PDF_TITLE_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Parâmetros", leftX, y);
  doc.text("Resultados", rightX, y);
  y += 10;

  const endLeft = drawCompactTable(compactRowsLeft, leftX, y, colW);
  const endRight = drawCompactTable(compactRowsRight, rightX, y, colW);
  y = Math.max(endLeft, endRight) + 14;

  doc.setTextColor(...PDF_TITLE_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Fórmulas", margin, y);
  y += 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const formulaLines = [
    "custo_hora = custo_mensal / 220",
    "cp_anual = qtd_pessoas * horas_mensais * custo_hora * 12",
    "economia_mensal = qtd_pessoas * horas_mensais * custo_hora",
    "payback = custo_desenvolvimento / economia_mensal",
    "score_final = 0.35*cp_score + 0.30*pb_score + 0.20*(6-complexidade) + 0.15*dev_interno",
  ];
  formulaLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 11;
  });

  y += 6;
  doc.setTextColor(90, 101, 121);
  doc.setFontSize(8);
  const nota = [
    `Complexidade: maior valor = maior complexidade.`,
    `Desenvolvimento interno: maior valor = maior aderência interna.`,
    `Pesos: CP ${pesosLabel(metodologia, "cp_score")}, Payback ${pesosLabel(metodologia, "pb_score")}, Complexidade ${pesosLabel(metodologia, "complexidade_invertida")}, Dev. interno ${pesosLabel(metodologia, "dev_interno")}.`,
  ];
  nota.forEach((line) => {
    doc.text(line, margin, y);
    y += 10;
  });

  doc.save("Relatorio_Priorizacao.pdf");
}
function recalcKpis(projects) {
  const total = projects.length;
  const ativos = projects.filter((p) => ["em_andamento", "proxima_sprint"].includes(p.status)).length;
  const concluidos = projects.filter((p) => p.status === "concluido").length;
  const pausados = projects.filter((p) => p.status === "pausado").length;
  const criticos = projects.filter((p) => ["urgente", "critica"].includes(p.criticidade)).length;
  const hoje = new Date();
  const atrasados = projects.filter((p) => { const fim = parseDate(p.previsao_termino); return fim && fim < hoje && !p.termino_real && p.status !== "concluido"; }).length;
  const progressoMedio = total ? Number((projects.reduce((acc, p) => acc + Number(p.progresso || 0), 0) / total).toFixed(2)) : 0;
  const taxaConclusao = total ? Number(((concluidos / total) * 100).toFixed(2)) : 0;
  const orcamentoTotal = Number(projects.reduce((acc, p) => acc + Number(p.orcamento || 0), 0).toFixed(2));
  const custoTotal = Number(projects.reduce((acc, p) => acc + Number(p.custo_atual || 0), 0).toFixed(2));
  return { total, ativos, concluidos, atrasados, pausados, criticos, progressoMedio, taxaConclusao, orcamentoTotal, custoTotal };
}

function renderDashboardKpis(projects) {
  const k = recalcKpis(projects);
  $("dashboard-kpis").innerHTML = `<article class="kpi-card"><h4>Total de projetos</h4><strong>${k.total}</strong></article><article class="kpi-card"><h4>Ativos</h4><strong>${k.ativos}</strong></article><article class="kpi-card"><h4>Concluídos</h4><strong>${k.concluidos}</strong></article><article class="kpi-card"><h4>Atrasados</h4><strong>${k.atrasados}</strong></article><article class="kpi-card"><h4>Críticos</h4><strong>${k.criticos}</strong></article><article class="kpi-card"><h4>Taxa conclusão</h4><strong>${k.taxaConclusao}%</strong></article><article class="kpi-card"><h4>Progresso médio</h4><strong>${k.progressoMedio}%</strong></article><article class="kpi-card"><h4>Orçamento total</h4><strong>R$ ${k.orcamentoTotal}</strong></article>`;
}

function renderDashboardTable(projects) {
  const tbody = $("dashboard-table");
  tbody.innerHTML = "";
  projects.forEach((p) => {
    const expanded = dashboardSummaryExpandedProjects.has(p.id);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><div class="actions-wrap"><button class="btn ghost btn-sm btn-dash-expand-row" data-id="${p.id}" title="${expanded ? "Recolher etapas" : "Expandir etapas"}">${expanded ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT}</button><button class="btn ghost btn-sm btn-dash-edit-row" data-id="${p.id}" title="Editar projeto">${ICON_EDIT}</button></div></td><td>${escapeHtml(p.nome || "")}</td><td>${escapeHtml(statusLabel(p.status))}</td><td>${escapeHtml(p.responsavel || "")}</td><td>${escapeHtml(p.focal || "-")}</td><td>${escapeHtml(p.setor_projeto || "-")}</td><td>${escapeHtml(statusLabel(p.criticidade || ""))}</td><td>${escapeHtml(dateLabel(p.data_inicio_previsto || p.dt_inicio_real))}</td><td>${escapeHtml(dateLabel(p.previsao_termino || p.termino_real))}</td><td>${Number(p.progresso || 0)}%</td>`;
    tbody.appendChild(tr);
    if (expanded) {
      const etapas = Array.isArray(p.etapas) ? [...p.etapas] : [];
      etapas.sort((a, b) => String(a.prazo || "9999-12-31").localeCompare(String(b.prazo || "9999-12-31")));
      etapas.forEach((e) => {
        const etr = document.createElement("tr");
        etr.className = "dash-sub-row";
        etr.innerHTML = `<td></td><td class="dash-sub-title">${ICON_BULLET} ${escapeHtml(e.nome || "Etapa")}</td><td>${escapeHtml(statusLabel(e.status || ""))}</td><td>${escapeHtml(e.responsavel || "-")}</td><td></td><td></td><td>${escapeHtml(statusLabel(e.criticidade || ""))}</td><td></td><td>${escapeHtml(dateLabel(e.prazo))}</td><td></td>`;
        tbody.appendChild(etr);
      });
    }
  });
  $$(".btn-dash-expand-row").forEach((btn) => btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    if (dashboardSummaryExpandedProjects.has(id)) dashboardSummaryExpandedProjects.delete(id);
    else dashboardSummaryExpandedProjects.add(id);
    renderDashboardTable(getSortedDashboardProjects(projects));
  }));
  $$(".btn-dash-edit-row").forEach((btn) => btn.addEventListener("click", () => openProjectEdit(btn.dataset.id)));
}

function getSortedDashboardProjects(projects) {
  const sortBy = $("dash-sort-by")?.value || "data_inicio_previsto";
  const sortDir = $("dash-sort-dir")?.value || "asc";
  const mult = sortDir === "desc" ? -1 : 1;
  const sorted = [...projects];
  sorted.sort((a, b) => {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];
    if (sortBy === "progresso" || sortBy === "orcamento" || sortBy === "custo_atual") {
      return (Number(av || 0) - Number(bv || 0)) * mult;
    }
    if (sortBy === "data_inicio_previsto" || sortBy === "previsao_termino") {
      const ad = parseDate(av) || new Date("1900-01-01");
      const bd = parseDate(bv) || new Date("1900-01-01");
      return (ad - bd) * mult;
    }
    return String(av || "").localeCompare(String(bv || ""), "pt-BR", { sensitivity: "base" }) * mult;
  });
  return sorted;
}

function destroyDashboardCharts() {
  Object.values(dashboardCharts).forEach((chart) => {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  });
  Object.keys(dashboardCharts).forEach((k) => delete dashboardCharts[k]);
}

function destroyProcessDashboardCharts() {
  Object.values(procDashboardCharts).forEach((chart) => {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  });
  Object.keys(procDashboardCharts).forEach((k) => delete procDashboardCharts[k]);
}

function getValueLabelPlugin() {
  return {
    id: "valueLabelPlugin",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      ctx.save();
      ctx.font = "700 14px Segoe UI";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;
        meta.data.forEach((element, index) => {
          const raw = Number(dataset.data[index] || 0);
          if (!raw) return;
          const isHorizontal = chart.options?.indexAxis === "y";
          const pos = typeof element.tooltipPosition === "function" ? element.tooltipPosition() : { x: element.x, y: element.y };
          const text = String(raw);
          const textW = ctx.measureText(text).width;
          let x = isHorizontal ? (element.x + 10) : pos.x;
          let y = isHorizontal ? pos.y : (pos.y - 12);
          if (isHorizontal) {
            const minX = chartArea.left + 2;
            const maxX = chartArea.right - textW - 2;
            if (x < minX) x = minX;
            if (x > maxX) x = maxX;
          } else {
            const minX = chartArea.left + (textW / 2) + 2;
            const maxX = chartArea.right - (textW / 2) - 2;
            if (x < minX) x = minX;
            if (x > maxX) x = maxX;
          }
          if (y < chartArea.top + 8) y = chartArea.top + 8;
          ctx.fillStyle = "#000000";
          ctx.textAlign = isHorizontal ? "left" : "center";
          ctx.strokeText(text, x, y);
          ctx.fillText(text, x, y);
        });
      });
      ctx.restore();
    },
  };
}

function aggregateCount(projects, key, mapFn = (v) => v || "Não informado") {
  const out = {};
  projects.forEach((p) => {
    const label = mapFn(p[key]);
    out[label] = (out[label] || 0) + 1;
  });
  return out;
}

function getLastSixMonthsLabels() {
  const labels = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) });
  }
  return labels;
}

function ymKey(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderDashboardCharts(projects) {
  if (typeof Chart === "undefined") return;
  destroyDashboardCharts();
  const valueLabelPlugin = getValueLabelPlugin();

  const statusOrder = ["backlog", "proxima_sprint", "em_andamento", "atrasado", "pausado", "concluido", "cancelado"];
  const statusMap = Object.fromEntries(statusOrder.map((k) => [k, 0]));
  const now = new Date();
  projects.forEach((p) => {
    const normalized = normalizeProjectStatus(p.status);
    const prazo = parseDate(p.previsao_termino);
    const isAtrasado = prazo && prazo < now && normalized !== "concluido" && normalized !== "cancelado" && !p.termino_real;
    const key = isAtrasado ? "atrasado" : (normalized || "backlog");
    if (!(key in statusMap)) statusMap[key] = 0;
    statusMap[key] += 1;
  });
  const statusKeys = statusOrder.filter((k) => Number(statusMap[k] || 0) > 0);
  const statusLabels = statusKeys.map((k) => statusLabel(k));
  const statusData = statusKeys.map((k) => statusMap[k] || 0);
  const statusColors = statusKeys.map((k) => GANTT_STATUS_COLORS[k] || "#64748b");
  dashboardCharts.status = new Chart($("chart-status"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: {
      labels: statusLabels,
      datasets: [{ label: "Projetos", data: statusData, backgroundColor: statusColors }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grace: "30%", display: false, grid: { display: false }, ticks: { display: false } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const critMap = { Urgente: 0, "Crítica": 0, Alta: 0, "Média": 0, Baixa: 0 };
  projects.forEach((p) => {
    const c = String(p.criticidade || "").toLowerCase().trim();
    if (c === "urgente") critMap.Urgente += 1;
    else if (c === "critica") critMap["Crítica"] += 1;
    else if (c === "alta") critMap["Alta"] += 1;
    else if (c === "media") critMap["Média"] += 1;
    else critMap["Baixa"] += 1;
  });
  const critLabels = ["Baixa", "Média", "Alta", "Crítica", "Urgente"];
  const critData = critLabels.map((l) => critMap[l]);
  dashboardCharts.criticidade = new Chart($("chart-criticidade"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: {
      labels: critLabels,
      datasets: [{ label: "Projetos", data: critData, backgroundColor: ["#22c55e", "#06b6d4", "#f59e0b", "#ef4444", "#7c3aed"] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grace: "30%", display: false, grid: { display: false }, ticks: { display: false } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const setorMap = aggregateCount(projects, "setor_projeto", (v) => v || "Não informado");
  const setorLabels = Object.keys(setorMap);
  dashboardCharts.setor = new Chart($("chart-setor"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: { labels: setorLabels, datasets: [{ label: "Projetos", data: setorLabels.map((l) => setorMap[l]), backgroundColor: "#3b82f6" }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      layout: { padding: { top: 18 } },
      scales: {
        x: { beginAtZero: true, grace: "25%", display: false, ticks: { display: false }, grid: { display: false } },
        y: { grid: { display: false } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const respMap = {};
  projects.forEach((p) => {
    const name = p.responsavel || "Não informado";
    if (!respMap[name]) respMap[name] = 0;
    respMap[name] += 1;
  });
  const respLabels = Object.keys(respMap);
  dashboardCharts.responsavel = new Chart($("chart-responsavel"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: {
      labels: respLabels,
      datasets: [{ label: "Projetos", data: respLabels.map((l) => respMap[l]), backgroundColor: "#3b82f6" }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      layout: { padding: { top: 18 } },
      scales: {
        x: { beginAtZero: true, grace: "25%", display: false, ticks: { display: false }, grid: { display: false } },
        y: { grid: { display: false } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });
}

function renderProcessDashboardKpis(kpis = {}) {
  $("proc-dashboard-kpis").innerHTML = `
    <article class="kpi-card"><h4>Total de processos</h4><strong>${Number(kpis.total_processos || 0)}</strong></article>
    <article class="kpi-card"><h4>Total de etapas</h4><strong>${Number(kpis.total_etapas || 0)}</strong></article>
    <article class="kpi-card"><h4>Média de etapas por processo</h4><strong>${Number(kpis.media_etapas || 0)}</strong></article>
    <article class="kpi-card"><h4>Processos ativos</h4><strong>${Number(kpis.ativos || 0)}</strong></article>
    <article class="kpi-card"><h4>Rascunhos</h4><strong>${Number(kpis.rascunhos || 0)}</strong></article>
    <article class="kpi-card"><h4>Inativos</h4><strong>${Number(kpis.inativos || 0)}</strong></article>
    <article class="kpi-card"><h4>Setores com processo</h4><strong>${Number(kpis.departamentos_com_processo || 0)}</strong></article>
    <article class="kpi-card"><h4>Responsáveis ativos</h4><strong>${Number(kpis.responsaveis_ativos || 0)}</strong></article>
  `;
}

function renderProcessDashboardCharts(charts = {}) {
  if (typeof Chart === "undefined") return;
  destroyProcessDashboardCharts();
  const valueLabelPlugin = getValueLabelPlugin();

  const deptMap = charts.processos_por_departamento || {};
  const deptLabels = Object.entries(deptMap).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k]) => k);
  procDashboardCharts.dept = new Chart($("chart-proc-dept"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: { labels: deptLabels, datasets: [{ label: "Processos", data: deptLabels.map((l) => deptMap[l]), backgroundColor: "#3b82f6" }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y", layout: { padding: { top: 18 } },
      scales: { x: { beginAtZero: true, grace: "25%", display: false, ticks: { display: false }, grid: { display: false } }, y: { grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const stepsDeptMap = charts.etapas_por_departamento || {};
  const stepsDeptLabels = Object.entries(stepsDeptMap).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k]) => k);
  procDashboardCharts.stepsDept = new Chart($("chart-proc-steps-dept"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: { labels: stepsDeptLabels, datasets: [{ label: "Etapas", data: stepsDeptLabels.map((l) => stepsDeptMap[l]), backgroundColor: "#10b981" }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y", layout: { padding: { top: 18 } },
      scales: { x: { beginAtZero: true, grace: "25%", display: false, ticks: { display: false }, grid: { display: false } }, y: { grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const respMap = charts.processos_por_responsavel || {};
  const respLabels = Object.keys(respMap);
  procDashboardCharts.resp = new Chart($("chart-proc-resp"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: { labels: respLabels, datasets: [{ label: "Processos", data: respLabels.map((l) => respMap[l]), backgroundColor: "#f59e0b" }] },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y", layout: { padding: { top: 18 } },
      scales: { x: { beginAtZero: true, grace: "25%", display: false, ticks: { display: false }, grid: { display: false } }, y: { grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });

  const statusMap = charts.status_processos || {};
  const statusLabels = ["ativo", "rascunho", "inativo"];
  procDashboardCharts.status = new Chart($("chart-proc-status"), {
    type: "bar",
    plugins: [valueLabelPlugin],
    data: {
      labels: ["Ativo", "Rascunho", "Inativo"],
      datasets: [{ label: "Processos", data: statusLabels.map((s) => Number(statusMap[s] || 0)), backgroundColor: ["#10b981", "#f59e0b", "#ef4444"] }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 18 } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grace: "30%", display: false, grid: { display: false }, ticks: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  });
}

function populateProcessDashboardFilters(processos = []) {
  const depts = [...new Set(processos.map((p) => p.departamento_nome).filter(Boolean))].sort();
  const resps = [...new Set(processos.map((p) => p.responsavel_nome).filter(Boolean))].sort();
  const deptSel = $("proc-dash-filter-dept");
  const respSel = $("proc-dash-filter-resp");
  const currDept = getMultiFilterValues("proc-dash-filter-dept");
  const currResp = getMultiFilterValues("proc-dash-filter-resp");
  deptSel.innerHTML = `<option value="">Todos</option>${depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}`;
  respSel.innerHTML = `<option value="">Todos</option>${resps.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}`;
  buildMultiFilterControl("proc-dash-filter-dept");
  buildMultiFilterControl("proc-dash-filter-resp");
  setMultiFilterValues("proc-dash-filter-dept", currDept);
  setMultiFilterValues("proc-dash-filter-resp", currResp);
}

async function loadProcessDashboard() {
  const deptNames = getMultiFilterValues("proc-dash-filter-dept");
  const respNames = getMultiFilterValues("proc-dash-filter-resp");
  const statusValues = getMultiFilterValues("proc-dash-filter-status");
  const data = await api("/api/processos");
  const all = data.processos || [];
  populateProcessDashboardFilters(all);
  const deptSet = new Set(deptNames);
  const respSet = new Set(respNames);
  const statusSet = new Set(statusValues);
  const filtered = all.filter((p) => {
    if (deptSet.size && !deptSet.has(String(p.departamento_nome || ""))) return false;
    if (respSet.size && !respSet.has(String(p.responsavel_nome || ""))) return false;
    if (statusSet.size && !statusSet.has(String(p.status || ""))) return false;
    return true;
  });
  const total_processos = filtered.length;
  const total_etapas = filtered.reduce((acc, p) => acc + ((p.etapas || []).length), 0);
  const media_etapas = total_processos ? Number((total_etapas / total_processos).toFixed(2)) : 0;
  const ativos = filtered.filter((p) => p.status === "ativo").length;
  const inativos = filtered.filter((p) => p.status === "inativo").length;
  const rascunhos = filtered.filter((p) => p.status === "rascunho").length;
  const kpis = {
    total_processos,
    total_etapas,
    media_etapas,
    departamentos_com_processo: new Set(filtered.map((p) => p.departamento_nome).filter(Boolean)).size,
    responsaveis_ativos: new Set(filtered.map((p) => p.responsavel_nome).filter(Boolean)).size,
    ativos,
    inativos,
    rascunhos,
  };
  const processByDept = {};
  const stepsByDept = {};
  const processByResp = {};
  const status_processos = { ativo: 0, rascunho: 0, inativo: 0 };
  filtered.forEach((p) => {
    const dept = String(p.departamento_nome || "Não informado");
    const resp = String(p.responsavel_nome || "Não informado");
    const st = String(p.status || "rascunho");
    processByDept[dept] = (processByDept[dept] || 0) + 1;
    stepsByDept[dept] = (stepsByDept[dept] || 0) + ((p.etapas || []).length);
    processByResp[resp] = (processByResp[resp] || 0) + 1;
    if (!(st in status_processos)) status_processos[st] = 0;
    status_processos[st] += 1;
  });
  const charts = {
    processos_por_departamento: processByDept,
    etapas_por_departamento: stepsByDept,
    processos_por_responsavel: processByResp,
    status_processos,
  };
  renderProcessDashboardKpis(kpis);
  renderProcessDashboardCharts(charts);
}

function renderGantt(projects) {
  const wrap = $("gantt-wrap");
  wrap.innerHTML = "";
  const withDates = projects.map((p, i) => ({ project: p, idx: i, ini: parseDate(p.data_inicio_previsto || p.dt_inicio_real), fim: parseDate(p.previsao_termino || p.termino_real) })).filter((x) => x.ini && x.fim && x.fim >= x.ini);
  if (!withDates.length) {
    wrap.innerHTML = `<div class="gantt-empty">Sem projetos com datas válidas para exibir no Gantt.</div>`;
    return;
  }
  const startMin = withDates.reduce((acc, x) => (x.ini < acc ? x.ini : acc), withDates[0].ini);
  const endMax = withDates.reduce((acc, x) => (x.fim > acc ? x.fim : acc), withDates[0].fim);
  const minDate = new Date(startMin.getFullYear(), startMin.getMonth(), startMin.getDate());
  const maxDate = new Date(endMax.getFullYear(), endMax.getMonth(), endMax.getDate());
  const timelineDays = Math.max(1, diffDays(minDate, maxDate) + 1);

  const dayTicks = [];
  let cursor = new Date(minDate);
  while (cursor <= maxDate) {
    dayTicks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  const tickLabelStep = dayTicks.length > 45 ? 3 : (dayTicks.length > 25 ? 2 : 1);

  const header = document.createElement("div");
  header.className = "gantt-row gantt-header";
  header.innerHTML = `<div class="gantt-name gantt-name-header">Projeto</div><div class="gantt-scale">${dayTicks.map((d) => {
    const idx = diffDays(minDate, d);
    const left = (idx / timelineDays) * 100;
    const showTickLabel = (idx % tickLabelStep) === 0;
    return `<div class="gantt-tick" style="left:${Math.max(0, Math.min(100, left))}%">${showTickLabel ? `<span>${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>` : ""}</div>`;
  }).join("")}</div>`;
  wrap.appendChild(header);

  withDates.forEach((x) => {
    const visual = getGanttProjectVisual(x.project, x.ini, x.fim);
    const startOffset = diffDays(minDate, x.ini);
    const durationDays = Math.max(1, diffDays(x.ini, x.fim) + 1);
    const left = (startOffset / timelineDays) * 100;
    const width = (durationDays / timelineDays) * 100;
    const projectRangeLabel = `${formatDatePtBr(x.ini)} - ${formatDatePtBr(x.fim)}`;
    const showProjectRange = width >= 18;
    const expanded = ganttExpandedProjects.has(x.project.id);
    const etapas = Array.isArray(x.project.etapas) ? [...x.project.etapas] : [];
    etapas.sort((a, b) => String(a.prazo || "9999-12-31").localeCompare(String(b.prazo || "9999-12-31")));

    const row = document.createElement("div");
    row.className = "gantt-row";
    row.innerHTML = `<div class="gantt-name"><button class="gantt-expand" data-id="${x.project.id}" title="${expanded ? "Recolher etapas" : "Expandir etapas"}">${expanded ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT}</button><span>${escapeHtml(x.project.nome || "Projeto")}</span></div><div class="gantt-track">${dayTicks.map((d) => {
      const lineLeft = (diffDays(minDate, d) / timelineDays) * 100;
      return `<span class="gantt-grid-line" style="left:${Math.max(0, Math.min(100, lineLeft))}%"></span>`;
    }).join("")}<div class="gantt-bar gantt-bar-date-only" title="${escapeHtml(projectRangeLabel)}" style="left:${left}%;width:${Math.min(width, 100 - left)}%;background:${visual.color};">${showProjectRange ? `<span class="gantt-range gantt-range-full">${projectRangeLabel}</span>` : ""}</div></div>`;
    wrap.appendChild(row);

    if (expanded) {
      etapas.forEach((etapa, etapaIdx) => {
        const etapaNome = String(etapa.nome || "").trim() || `Etapa ${String(etapaIdx + 1).padStart(2, "0")}`;
        const etapaStart = parseDate(etapa.inicio_previsto || etapa.inicio_real) || x.ini;
        const etapaEnd = parseDate(etapa.fim_previsto || etapa.prazo || etapa.fim_real) || etapaStart;
        if (etapaStart > etapaEnd) {
          return;
        }
        const stageVisual = getGanttStageVisual(etapa, etapaStart, etapaEnd);
        const stageOffset = diffDays(minDate, etapaStart);
        const stageDuration = Math.max(1, diffDays(etapaStart, etapaEnd) + 1);
        const stageLeft = (stageOffset / timelineDays) * 100;
        const stageWidth = (stageDuration / timelineDays) * 100;
        const stageRangeLabel = `${formatDatePtBr(etapaStart)} - ${formatDatePtBr(etapaEnd)}`;
        const showStageRange = stageWidth >= 20;
        const stageRow = document.createElement("div");
        stageRow.className = "gantt-row gantt-sub-row";
        stageRow.innerHTML = `<div class="gantt-name gantt-sub-name"><span class="gantt-sub-bullet">${ICON_BULLET}</span><span class="gantt-sub-title">${escapeHtml(etapaNome)}</span></div><div class="gantt-track gantt-sub-track">${dayTicks.map((d) => {
          const lineLeft = (diffDays(minDate, d) / timelineDays) * 100;
          return `<span class="gantt-grid-line" style="left:${Math.max(0, Math.min(100, lineLeft))}%"></span>`;
        }).join("")}<div class="gantt-bar gantt-sub-bar gantt-sub-bar-date-only" title="${escapeHtml(`${stageVisual.label} | ${stageRangeLabel}`)}" style="left:${stageLeft}%;width:${Math.min(stageWidth, 100 - stageLeft)}%;background:${stageVisual.color};">${showStageRange ? `<span class="gantt-range gantt-range-full">${stageRangeLabel}</span>` : ""}</div></div>`;
        wrap.appendChild(stageRow);
      });
    }
  });
  const legend = document.createElement("div");
  legend.className = "gantt-legend";
  legend.innerHTML = `<div class="gantt-legend-periodo">Período total: ${startMin.toLocaleDateString("pt-BR")} até ${endMax.toLocaleDateString("pt-BR")}</div>`;
  wrap.appendChild(legend);
  $$(".gantt-expand").forEach((btn) => btn.addEventListener("click", () => {
    const id = btn.dataset.id;
    if (ganttExpandedProjects.has(id)) ganttExpandedProjects.delete(id);
    else ganttExpandedProjects.add(id);
    renderGantt(projects);
  }));
}

function applyDashboardFilters() {
  const statuses = new Set(getMultiFilterValues("dash-filter-status"));
  const criticidades = new Set(getMultiFilterValues("dash-filter-criticidade"));
  const setores = new Set(getMultiFilterValues("dash-filter-setor"));
  const responsaveis = new Set(getMultiFilterValues("dash-filter-responsavel"));
  const etapaResponsavel = String($("dash-filter-etapa-responsavel")?.value || "").trim().toLowerCase();
  const filtered = dashboardProjects
    .map((project) => {
      if (!etapaResponsavel) return project;
      const etapas = Array.isArray(project.etapas) ? project.etapas : [];
      const etapasFiltradas = etapas.filter((etapa) => String(etapa?.responsavel || "").trim().toLowerCase().includes(etapaResponsavel));
      if (!etapasFiltradas.length) return null;
      return { ...project, etapas: etapasFiltradas };
    })
    .filter(Boolean)
    .filter((p) => {
    if (statuses.size && !statuses.has(String(p.status || ""))) return false;
    if (criticidades.size && !criticidades.has(String(p.criticidade || ""))) return false;
    if (setores.size && !setores.has(String(p.setor_projeto || ""))) return false;
    if (responsaveis.size && !responsaveis.has(String(p.responsavel || ""))) return false;
    return true;
  });
  const sorted = getSortedDashboardProjects(filtered);
  renderDashboardKpis(sorted);
  renderDashboardTable(sorted);
  renderGantt(sorted);
  renderDashboardCharts(sorted);
}

function populateDashboardCategoricalFilters(projects) {
  const setores = [...new Set(projects.map((p) => p.setor_projeto).filter(Boolean))].sort();
  const responsaveis = [...new Set(projects.map((p) => p.responsavel).filter(Boolean))].sort();
  const responsaveisEtapas = [...new Set(
    projects.flatMap((p) => (p.etapas || []).map((e) => String(e?.responsavel || "").trim()).filter(Boolean))
  )].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  const setorSel = $("dash-filter-setor");
  const respSel = $("dash-filter-responsavel");
  const etapaRespSel = $("dash-filter-etapa-responsavel");
  const currentSetor = getMultiFilterValues("dash-filter-setor");
  const currentResp = getMultiFilterValues("dash-filter-responsavel");
  const currentEtapaResp = etapaRespSel?.value || "";
  setorSel.innerHTML = `<option value="">Todos</option>${setores.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}`;
  respSel.innerHTML = `<option value="">Todos</option>${responsaveis.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}`;
  etapaRespSel.innerHTML = `<option value="">Todos</option>${responsaveisEtapas.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}`;
  buildMultiFilterControl("dash-filter-setor");
  buildMultiFilterControl("dash-filter-responsavel");
  buildSearchableSelectControl("dash-filter-etapa-responsavel");
  setMultiFilterValues("dash-filter-setor", currentSetor);
  setMultiFilterValues("dash-filter-responsavel", currentResp);
  if (currentEtapaResp) etapaRespSel.value = currentEtapaResp;
  buildSearchableSelectControl("dash-filter-etapa-responsavel");
}

async function loadDashboard() {
  const data = await api("/api/projects/dashboard");
  dashboardProjects = data.projects || [];
  populateDashboardCategoricalFilters(dashboardProjects);
  applyDashboardFilters();
}

async function openProjectEdit(projectId) {
  const p = (await api(`/api/projects/${projectId}`)).project;
  if (!usuariosCache.length) {
    try {
      await loadUsers();
    } catch (error) {
      console.warn("Falha ao carregar usuarios para editar projeto.", error);
    }
  }
  $("edit-project-id").value = p.id;
  $("edit-proj-nome").value = p.nome || "";
  const peopleOptions = (Array.isArray(usuariosCache) ? usuariosCache : []).map((user) => ({ id: user.id, nome: normalizeUserDisplayName(user) }));
  const responsavelFallbackValue = !p.responsavel_id && p.responsavel ? createFallbackPersonValue(p.responsavel) : "";
  const focalFallbackValue = !p.focal_id && p.focal ? createFallbackPersonValue(p.focal) : "";
  if (responsavelFallbackValue && !peopleOptions.some((opt) => String(opt.id) === responsavelFallbackValue)) {
    peopleOptions.push({ id: responsavelFallbackValue, nome: p.responsavel });
  }
  if (focalFallbackValue && !peopleOptions.some((opt) => String(opt.id) === focalFallbackValue)) {
    peopleOptions.push({ id: focalFallbackValue, nome: p.focal });
  }
  (p.participantes || []).forEach((name) => {
    const fallbackValue = createFallbackPersonValue(name);
    if (fallbackValue && !peopleOptions.some((opt) => String(opt.id) === fallbackValue)) {
      peopleOptions.push({ id: fallbackValue, nome: name });
    }
  });
  renderSimpleOptions("edit-proj-responsavel", peopleOptions, "Selecione...");
  renderSimpleOptions("edit-proj-focal", peopleOptions, "Selecione...");
  renderSimpleOptions("edit-proj-participantes", peopleOptions, "Selecione...");
  $("edit-proj-responsavel").value = p.responsavel_id || findUserIdByName(p.responsavel || "") || responsavelFallbackValue;
  $("edit-proj-focal").value = p.focal_id || findUserIdByName(p.focal || "") || focalFallbackValue;
  setSelectValues(
    "edit-proj-participantes",
    (p.participantes_ids || []).length
      ? (p.participantes_ids || [])
      : (p.participantes || []).map((name) => findUserIdByName(name) || createFallbackPersonValue(name)).filter(Boolean),
  );
  buildSearchableSelectControl("edit-proj-responsavel");
  buildSearchableSelectControl("edit-proj-focal");
  buildSearchableSelectControl("edit-proj-participantes");
  $("edit-proj-status").value = p.status || "backlog";
  $("edit-proj-criticidade").value = p.criticidade || "media";
  $("edit-proj-data-inicio-previsto").value = p.data_inicio_previsto || "";
  $("edit-proj-previsao-termino").value = p.previsao_termino || "";
  $("edit-proj-descricao").value = p.descricao || "";
  const container = $("edit-etapas-container");
  container.innerHTML = "";
  (p.etapas || []).forEach((e) => addEditStageRow(e));
  if (!(p.etapas || []).length) addEditStageRow();
  $("edit-project-msg").textContent = "";
  $("project-edit-modal").classList.remove("hidden");
}

async function saveProjectEdit() {
  const projectId = $("edit-project-id").value;
  if (!projectId) return;
  $("edit-project-msg").textContent = "";
  try {
    const current = (await api(`/api/projects/${projectId}`)).project;
    const responsavelSelection = parsePersonSelection($("edit-proj-responsavel").value);
    const focalSelection = parsePersonSelection($("edit-proj-focal").value);
    const participantesSelection = getSelectValues("edit-proj-participantes");
    const payload = {
      ...current,
      nome: $("edit-proj-nome").value.trim(),
      responsavel: responsavelSelection.name || getSelectOptionLabel("edit-proj-responsavel", $("edit-proj-responsavel").value) || current.responsavel || "",
      responsavel_id: responsavelSelection.id,
      focal: focalSelection.name || getSelectOptionLabel("edit-proj-focal", $("edit-proj-focal").value) || current.focal || "",
      focal_id: focalSelection.id,
      participantes_ids: participantesSelection,
      status: $("edit-proj-status").value,
      criticidade: $("edit-proj-criticidade").value,
      data_inicio_previsto: $("edit-proj-data-inicio-previsto").value,
      previsao_termino: $("edit-proj-previsao-termino").value,
      descricao: $("edit-proj-descricao").value.trim(),
      participantes: participantesSelection.map((value) => parsePersonSelection(value).name || getSelectOptionLabel("edit-proj-participantes", value) || value).filter(Boolean),
      etapas: collectStages("edit-etapas-container", true),
    };
    await api(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify(payload) });
    $("project-edit-modal").classList.add("hidden");
    await Promise.all([loadProjects(), loadDashboard()]);
  } catch (error) {
    $("edit-project-msg").textContent = error.message;
  }
}

async function addQuickComment(projectId, text) {
  const current = (await api(`/api/projects/${projectId}`)).project;
  const anotacoes = Array.isArray(current.anotacoes) ? current.anotacoes : [];
  const autor = currentUser?.nome || currentUser?.email || currentUser?.username || "Usuário";
  anotacoes.push({ id: crypto.randomUUID(), conteudo: text, data: new Date().toISOString(), usuario: autor, anexos: [], status: "pendente", respostas: [] });
  const tag = `[${new Date().toLocaleDateString("pt-BR")}] ${text}`;
  const payload = { ...current, anotacoes, anotacoes_gerais: [current.anotacoes_gerais || "", tag].filter(Boolean).join("\n") };
  await api(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify(payload) });
}

async function startProcess() { try { await api("/api/process/start", { method: "POST" }); await refreshProcessState(); } catch (error) { alert(error.message); } }
async function stopProcess() { await api("/api/process/stop", { method: "POST" }); await refreshProcessState(); }
async function scanDocuments() { try { await api("/api/scan", { method: "POST" }); await refreshProcessState(); } catch (error) { alert(error.message); } }

async function approvePreview() {
  if (!currentPreview || typeof currentPreview.index !== "number") return void alert("Nenhum preview selecionado.");
  const payload = { index: currentPreview.index, documents: { ficha_tecnica: $("editor-ficha_tecnica").value, fluxograma: $("editor-fluxograma").value, riscos: $("editor-riscos").value } };
  try {
    const data = await api("/api/process/approve", { method: "POST", body: JSON.stringify(payload) });
    hidePreview();
    renderProcessState(data.state);
  } catch (error) { alert(error.message); }
}

async function cancelPreview() { await api("/api/process/cancel", { method: "POST" }); hidePreview(); await refreshProcessState(); }
async function regeneratePreview() { if (!currentPreview || typeof currentPreview.index !== "number") return; const data = await api("/api/process/regenerate", { method: "POST", body: JSON.stringify({ index: currentPreview.index }) }); showPreview(data.preview); renderProcessState(data.state); }

function bindEvents() {
  $$(".menu-item").forEach((btn) => btn.addEventListener("click", async () => {
    if (!btn.dataset.view) return;
    setActiveView(btn.dataset.view);
    if (btn.dataset.view === "view-projetos-cadastrar") await loadUsers();
    if (btn.dataset.view === "view-projetos-consultar") await loadProjects();
    if (btn.dataset.view === "view-projetos-dashboard") {
      await loadUsers();
      await loadDashboard();
    }
    if (btn.dataset.view === "view-processos-dashboard") await loadProcessDashboard();
    if (btn.dataset.view === "view-processos-cadastro") {
      if (hasPermission("view-cadastros-usuarios") || hasPermission("view-processos-cadastro")) await loadUsers();
      await loadProcessos();
    }
    if (btn.dataset.view === "view-processos-consulta") await loadProcessos();
    if (btn.dataset.view === "view-cadastros-script-perguntas") renderProcessScriptQuestions();
    if (btn.dataset.view === "view-cadastros-cargos") await loadCargos();
    if (btn.dataset.view === "view-cadastros-usuarios") await loadUsers();
    if (btn.dataset.view === "view-cadastros-perfis") await loadRoles();
  }));
  $("btn-sidebar-toggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("collapsed");
    localStorage.setItem("sidebarCollapsed", $("sidebar").classList.contains("collapsed") ? "1" : "0");
  });
  $$(".menu-group-toggle").forEach((btn) => btn.addEventListener("click", () => {
    const group = btn.dataset.group;
    if (!group) return;
    const container = document.querySelector(`.menu-group[data-group="${group}"]`);
    if (!container) return;
    const nextCollapsed = !container.classList.contains("collapsed-group");
    setMenuGroupCollapsed(group, nextCollapsed);
    const state = getMenuGroupsState();
    state[group] = nextCollapsed;
    localStorage.setItem(MENU_GROUPS_STORAGE_KEY, JSON.stringify(state));
  }));
  $("origem_path").addEventListener("input", () => { configDirty = true; });
  $("destino_path").addEventListener("input", () => { configDirty = true; });
  $("btn-save-config").addEventListener("click", () => withButtonBusy($("btn-save-config"), saveConfig, "Salvando..."));
  $("btn-scan").addEventListener("click", () => withButtonBusy($("btn-scan"), scanDocuments, "Escaneando..."));
  $("btn-start").addEventListener("click", () => withButtonBusy($("btn-start"), startProcess, "Processando..."));
  $("btn-stop").addEventListener("click", () => withButtonBusy($("btn-stop"), stopProcess, "Parando..."));
  $("btn-select-all").addEventListener("click", () => setDocSelection("all"));
  $("btn-select-none").addEventListener("click", () => setDocSelection("none"));
  $("btn-select-invert").addEventListener("click", () => setDocSelection("invert"));
  $("btn-log-main").addEventListener("click", () => {
    $("btn-log-main").classList.add("active-log");
    $("btn-log-detail").classList.remove("active-log");
    $("log-summary").classList.remove("hidden");
    $("log-detailed").classList.add("hidden");
  });
  $("btn-log-detail").addEventListener("click", () => {
    $("btn-log-detail").classList.add("active-log");
    $("btn-log-main").classList.remove("active-log");
    $("log-detailed").classList.remove("hidden");
    $("log-summary").classList.add("hidden");
  });
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => activatePreviewTab(tab.dataset.doc)));
  $("btn-close-preview").addEventListener("click", hidePreview);
  $("btn-cancel").addEventListener("click", () => withButtonBusy($("btn-cancel"), cancelPreview, "Cancelando..."));
  $("btn-regenerate").addEventListener("click", () => withButtonBusy($("btn-regenerate"), regeneratePreview, "Gerando..."));
  $("btn-approve").addEventListener("click", () => withButtonBusy($("btn-approve"), approvePreview, "Salvando..."));
  $("btn-prio-calculate").addEventListener("click", calculatePriorizacao);
  $("btn-prio-word").addEventListener("click", downloadPriorizacaoWord);
  $("btn-prio-pdf").addEventListener("click", downloadPriorizacaoPdf);
  bindCurrencyInput("prio-custo-mensal");
  bindCurrencyInput("prio-custo-desenvolvimento");
  $("btn-prio-help").addEventListener("click", () => $("prio-help-modal").classList.remove("hidden"));
  $("btn-close-prio-help").addEventListener("click", () => $("prio-help-modal").classList.add("hidden"));
  $("btn-process-help")?.addEventListener("click", () => {
    renderProcessScriptQuestions();
    $("process-help-msg").textContent = "";
    setActiveView("view-cadastros-script-perguntas");
  });
  $("process-script-profile-select")?.addEventListener("change", (e) => {
    setActiveProcessScriptProfile(e.target.value);
  });
  $("process-script-group-select")?.addEventListener("change", (e) => {
    setActiveProcessScriptGroup(e.target.value);
  });
  $("btn-process-profile-new")?.addEventListener("click", createProcessScriptProfile);
  $("btn-process-profile-delete")?.addEventListener("click", deleteActiveProcessScriptProfile);
  $("btn-process-group-new")?.addEventListener("click", createProcessScriptGroup);
  $("btn-process-group-edit")?.addEventListener("click", editActiveProcessScriptGroup);
  $("btn-process-group-delete")?.addEventListener("click", deleteActiveProcessScriptGroup);
  $("btn-process-question-add")?.addEventListener("click", () => {
    const { store, active, group } = getActiveProcessScriptGroup();
    if (!active || !group) return;
    group.perguntas.push({ pergunta: "Nova pergunta", exemplo: "Ex.: resposta esperada." });
    saveProcessScriptStore(store);
    renderProcessScriptQuestions();
  });
  $("btn-process-question-reset")?.addEventListener("click", () => {
    resetActiveProcessScriptToDefault();
    renderProcessScriptQuestions();
    $("process-help-msg").style.color = "green";
    $("process-help-msg").textContent = "Roteiro restaurado para o padrão da área selecionada.";
  });
  $("btn-process-question-save")?.addEventListener("click", () => {
    saveProcessScriptQuestions();
    $("process-help-msg").style.color = "green";
    $("process-help-msg").textContent = "Roteiro salvo com sucesso.";
    renderProcessScriptQuestions();
  });
  $("btn-process-question-word")?.addEventListener("click", () => {
    saveProcessScriptQuestions();
    downloadProcessScriptWord();
  });
  $("btn-process-question-pdf")?.addEventListener("click", () => {
    saveProcessScriptQuestions();
    downloadProcessScriptPdf();
  });
  $("btn-logout").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  });
  $("btn-add-etapa").addEventListener("click", () => addStageRow());
  $("btn-cadastrar-projeto").addEventListener("click", submitProject);
  $("btn-filtrar-projetos").addEventListener("click", loadProjects);
  $("btn-limpar-filtros").addEventListener("click", async () => {
    ["flt-nome", "flt-responsavel", "flt-data-inicio", "flt-data-fim"].forEach((id) => { $(id).value = ""; });
    setMultiFilterValues("flt-status", []);
    await loadProjects();
  });
  $("btn-view-lista").addEventListener("click", () => setProjectViewMode("lista"));
  $("btn-view-cards").addEventListener("click", () => setProjectViewMode("cards"));
  $("btn-add-setor").addEventListener("click", addSetor);
  $("btn-add-cargo")?.addEventListener("click", addCargo);
  $("btn-add-user").addEventListener("click", saveUser);
  $("btn-cancel-user-edit").addEventListener("click", clearUserForm);
  $("btn-usr-filter")?.addEventListener("click", loadUsers);
  $("btn-add-role").addEventListener("click", saveRole);
  $("btn-cancel-role-edit").addEventListener("click", clearRoleForm);
  $("usr-has-login")?.addEventListener("change", () => {
    const hasLogin = $("usr-has-login").value === "sim";
    $("usr-role").disabled = !hasLogin;
  });
  $("btn-proc-add-etapa")?.addEventListener("click", () => addProcessStage());
  $("btn-proc-save")?.addEventListener("click", saveProcesso);
  $("btn-proc-clear")?.addEventListener("click", clearProcessForm);
  $("btn-proc-search-edit")?.addEventListener("click", searchProcessosForEdit);
  $("btn-proc-load-edit")?.addEventListener("click", loadSelectedProcessForEdit);
  $("proc-edit-search")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchProcessosForEdit();
    }
  });
  $("btn-proc-filtrar")?.addEventListener("click", loadProcessos);
  $("btn-proc-limpar-filtro")?.addEventListener("click", async () => {
    $("proc-flt-nome").value = "";
    setMultiFilterValues("proc-flt-departamento", []);
    setMultiFilterValues("proc-flt-status", []);
    await loadProcessos();
  });
  $("btn-proc-view-list")?.addEventListener("click", () => setProcessConsultaView("list"));
  $("btn-proc-view-flow")?.addEventListener("click", () => {
    setProcessConsultaView("flow");
    renderProcessFlow(processosCache);
  });
  $("btn-proc-expand-all")?.addEventListener("click", () => {
    Object.keys((processosCache || []).reduce((acc, p) => {
      const dept = p.departamento_nome || "Sem setor";
      const id = `dept-${dept.toLowerCase().replaceAll(" ", "-")}`;
      acc[id] = true;
      return acc;
    }, {})).forEach((id) => processoDeptExpanded.add(id));
    (processosCache || []).forEach((p) => processoItemExpanded.add(p.id));
    processoItemStagesCollapsed.clear();
    renderProcessList(processosCache);
  });
  $("btn-proc-collapse-all")?.addEventListener("click", () => {
    processoDeptExpanded.clear();
    processoItemExpanded.clear();
    (processosCache || []).forEach((p) => processoItemStagesCollapsed.add(p.id));
    renderProcessList(processosCache);
  });
  $("btn-proc-dash-apply")?.addEventListener("click", loadProcessDashboard);
  $("btn-proc-dash-clear")?.addEventListener("click", () => {
    setMultiFilterValues("proc-dash-filter-dept", []);
    setMultiFilterValues("proc-dash-filter-resp", []);
    setMultiFilterValues("proc-dash-filter-status", []);
    loadProcessDashboard();
  });
  $("btn-dash-apply-filters").addEventListener("click", applyDashboardFilters);
  $("btn-dash-clear-filters").addEventListener("click", () => {
    setMultiFilterValues("dash-filter-status", []);
    setMultiFilterValues("dash-filter-criticidade", []);
    setMultiFilterValues("dash-filter-setor", []);
    setMultiFilterValues("dash-filter-responsavel", []);
    $("dash-filter-etapa-responsavel").value = "";
    applyDashboardFilters();
  });
  $("dash-filter-etapa-responsavel").addEventListener("change", applyDashboardFilters);
  $("dash-sort-by").addEventListener("change", applyDashboardFilters);
  $("dash-sort-dir").addEventListener("change", applyDashboardFilters);
  $("btn-dash-expand-all").addEventListener("click", () => {
    dashboardSummaryExpandedProjects.clear();
    dashboardProjects.forEach((p) => dashboardSummaryExpandedProjects.add(p.id));
    applyDashboardFilters();
  });
  $("btn-dash-collapse-all").addEventListener("click", () => {
    dashboardSummaryExpandedProjects.clear();
    applyDashboardFilters();
  });
  $("btn-close-project-details").addEventListener("click", () => $("project-details-modal").classList.add("hidden"));
  $("btn-close-project-edit").addEventListener("click", () => $("project-edit-modal").classList.add("hidden"));
  $("btn-close-process-stage-modal")?.addEventListener("click", () => $("process-stage-modal").classList.add("hidden"));
  $("btn-edit-add-etapa").addEventListener("click", () => addEditStageRow());
  $("btn-save-project-edit").addEventListener("click", saveProjectEdit);
  $("btn-change-password").addEventListener("click", async () => {
    $("pwd-msg").textContent = "";
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: $("pwd-current").value,
          new_password: $("pwd-new").value,
        }),
      });
      $("must-change-password-modal").classList.add("hidden");
      $("pwd-current").value = "";
      $("pwd-new").value = "";
      if (currentUser) currentUser.must_change_password = false;
    } catch (error) {
      $("pwd-msg").textContent = error.message;
    }
  });
  $("ai-fab")?.addEventListener("click", () => toggleAiChat());
  $("ai-chat-close")?.addEventListener("click", () => toggleAiChat(false));
  $("ai-chat-send")?.addEventListener("click", sendAiChatMessage);
  $("ai-chat-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAiChatMessage();
    }
  });
}

async function bootstrap() {
  if (localStorage.getItem("sidebarCollapsed") === "1") $("sidebar").classList.add("collapsed");
  initMenuGroups();
  initMultiFilterControls();
  getProcessScriptStore();
  await loadCurrentUser();
  bindEvents();
  const firstAllowed = $$(".menu-item[data-view]").find((b) => !b.classList.contains("hidden"));
  setActiveView(firstAllowed?.dataset.view || "view-processos-analise");
  setProjectViewMode(projectViewMode);
  setProcessConsultaView(processConsultaViewMode);
  addStageRow();
  addProcessStage();

  const tasks = [refreshProcessState(), refreshLogs()];
  if (hasPermission("view-projetos-setores")) tasks.push(loadSetores());
  if (
    hasPermission("view-projetos-setores")
    || hasPermission("view-processos-cadastro")
    || hasPermission("view-cadastros-usuarios")
  ) {
    tasks.push(loadDepartamentos());
  }
  if (hasPermission("view-cadastros-cargos")) tasks.push(loadCargos());
  if (
    hasPermission("view-cadastros-usuarios")
    || hasPermission("view-processos-cadastro")
    || hasPermission("view-projetos-cadastrar")
    || hasPermission("view-projetos-consultar")
    || hasPermission("view-projetos-dashboard")
  ) {
    tasks.push(loadUsers());
  }
  if (hasPermission("view-processos-cadastro")) tasks.push(loadProcessos());
  if (hasPermission("view-processos-consulta")) tasks.push(loadProcessos());
  if (hasPermission("view-processos-dashboard")) tasks.push(loadProcessDashboard());
  if (hasPermission("view-projetos-consultar")) tasks.push(loadProjects());
  if (hasPermission("view-projetos-dashboard")) tasks.push(loadDashboard());
  await Promise.all(tasks);

  setInterval(() => { if (hasPermission("view-processos-analise")) refreshProcessState(); }, 2500);
  setInterval(() => { if (hasPermission("view-processos-analise")) refreshLogs(); }, 2500);
}

document.addEventListener("DOMContentLoaded", bootstrap);

