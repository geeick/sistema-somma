const TEXT_REPLACEMENTS: Record<string, string> = {
  "Sign In": "Entrar",
  "Sign in": "Entrar",
  "Sign Up": "Criar conta",
  "Sign up": "Criar conta",
  "Sign Out": "Sair",
  "Get Started": "Começar",
  "Start Earning": "Começar a participar",
  "Learn More": "Saiba mais",
  "Home": "Início",
  "Dashboard": "Painel",
  "Creator Dashboard": "Painel do criador",
  "Admin Dashboard": "Painel administrativo",
  "Campaigns": "Campanhas",
  "Active Campaigns": "Campanhas ativas",
  "Submissions": "Envios",
  "Creators": "Criadores",
  "Pages": "Páginas",
  "Wallet": "Carteira",
  "Settings": "Configurações",
  "Community": "Comunidade",
  "Payouts": "Pagamentos",
  "Payments": "Pagamentos",
  "Movements": "Movimentos",
  "Discover": "Descobrir",
  "How It Works": "Como funciona",
  "About": "Sobre",
  "Loading...": "Carregando...",
  "Loading": "Carregando",
  "Loading campaigns...": "Carregando campanhas...",
  "Loading videos...": "Carregando vídeos...",
  "Refresh": "Atualizar",
  "Create": "Criar",
  "Create Account": "Criar conta",
  "Create Free Account": "Criar conta gratuita",
  "Creating account...": "Criando conta...",
  "Signed in successfully!": "Entrada realizada com sucesso!",
  "Account created successfully! Redirecting...": "Conta criada com sucesso! Redirecionando...",
  "Failed to create account": "Não foi possível criar a conta",
  "Failed to sign in": "Não foi possível entrar",
  "Signup failed": "Cadastro falhou",
  "Invalid email address": "E-mail inválido",
  "Password must be at least 6 characters": "A senha precisa ter pelo menos 6 caracteres",
  "Full name must be at least 2 characters": "O nome completo precisa ter pelo menos 2 caracteres",
  "Full Name": "Nome completo",
  "Email": "E-mail",
  "Password": "Senha",
  "Welcome to CreatorPay": "Bem-vindo à Somma",
  "Sign in to your account or create a new one to start earning": "Entre na sua conta ou crie uma nova para começar a participar.",
  "you@example.com": "voce@exemplo.com",
  "John Doe": "Nome Sobrenome",
  "Upload Your Content": "Envie seu conteúdo",
  "Earn Money": "Ganhe dinheiro",
  "Track Performance": "Acompanhe resultados",
  "Ready to Get Paid?": "Pronto para receber?",
  "Upload your videos, track approved earnings, and withdraw your balance.": "Envie seus vídeos, acompanhe ganhos aprovados e solicite saques.",
  "Total Earnings": "Ganhos totais",
  "Available Now": "Disponível agora",
  "Total Videos": "Total de vídeos",
  "Pending Withdrawals": "Saques pendentes",
  "Total Approved Earnings": "Ganhos aprovados totais",
  "Available to Withdraw": "Disponível para saque",
  "Sum of approved or paid submissions.": "Soma dos envios aprovados ou pagos.",
  "Pending and paid withdrawals are already subtracted.": "Saques pendentes e pagos já foram descontados.",
  "Withdraw / View Wallet": "Sacar / Ver carteira",
  "Your Videos": "Seus vídeos",
  "No videos uploaded yet. Start uploading to earn!": "Nenhum vídeo enviado ainda. Comece a enviar para ganhar!",
  "Submission": "Envio",
  "View Post": "Ver publicação",
  "URL": "URL",
  "UserName": "Usuário",
  "Likes": "Curtidas",
  "Plays": "Reproduções",
  "Views": "Visualizações",
  "Earnings": "Ganhos",
  "Uploaded": "Enviado em",
  "Metrics Source": "Fonte das métricas",
  "Last Synced": "Última sincronização",
  "Not synced yet": "Ainda não sincronizado",
  "Not set": "Não informado",
  "pending": "pendente",
  "approved": "aprovado",
  "rejected": "rejeitado",
  "paid": "pago",
  "deleted": "excluído",
  "Submit Content": "Enviar conteúdo",
  "Submit content from one of your approved pages.": "Envie conteúdo de uma das suas páginas aprovadas.",
  "Campaign": "Campanha",
  "Campaign *": "Campanha *",
  "Selected campaign": "Campanha selecionada",
  "Select a campaign": "Selecione uma campanha",
  "No active campaigns available for this platform": "Nenhuma campanha ativa disponível para esta plataforma",
  "View campaign details": "Ver detalhes da campanha",
  "Required tags": "Tags obrigatórias",
  "Platform": "Plataforma",
  "Platform *": "Plataforma *",
  "Select platform": "Selecione a plataforma",
  "Approved Page *": "Página aprovada *",
  "Select one of your approved pages": "Selecione uma das suas páginas aprovadas",
  "Post URL *": "URL da publicação *",
  "Audio URL (Optional)": "URL do áudio (opcional)",
  "Submit": "Enviar",
  "Submitting...": "Enviando...",
  "Submitted": "Enviado",
  "Submitted for review": "Enviado para análise",
  "Submission uploaded for review!": "Conteúdo enviado para análise!",
  "Select one of your approved pages before submitting.": "Selecione uma das suas páginas aprovadas antes de enviar.",
  "The selected page does not match this campaign's required tags.": "A página selecionada não atende às tags obrigatórias desta campanha.",
  "Choose one of your authorized TikTok videos.": "Escolha um dos seus vídeos autorizados do TikTok.",
  "This campaign has ended and is no longer accepting submissions": "Esta campanha terminou e não aceita mais envios.",
  "Authorized TikTok Video *": "Vídeo autorizado do TikTok *",
  "Loading TikTok videos...": "Carregando vídeos do TikTok...",
  "Choose a video from your connected TikTok": "Escolha um vídeo do TikTok conectado",
  "No TikTok videos found": "Nenhum vídeo do TikTok encontrado",
  "View on TikTok": "Ver no TikTok",
  "No eligible approved tiktok pages found": "Nenhuma página aprovada do TikTok encontrada",
  "No eligible approved instagram pages found": "Nenhuma página aprovada do Instagram encontrada",
  "No eligible approved youtube shorts pages found": "Nenhuma página aprovada do YouTube Shorts encontrada",
  "Go to Pages and connect/verify this platform. If the campaign has required tags, your page must include at least one matching tag.": "Vá para Páginas e conecte/verifique esta plataforma. Se a campanha tiver tags obrigatórias, sua página precisa ter pelo menos uma tag compatível.",
  "This URL must belong to the approved page selected above.": "Esta URL precisa pertencer à página aprovada selecionada acima.",
  "Provide the audio link if you used the campaign's required audio.": "Informe o link do áudio se você usou o áudio obrigatório da campanha.",
  "Browse and join campaigns that match your pages": "Explore e participe de campanhas compatíveis com suas páginas",
  "Search campaigns...": "Buscar campanhas...",
  "No campaigns found matching your search.": "Nenhuma campanha encontrada para sua busca.",
  "No active campaigns available at the moment.": "Nenhuma campanha ativa disponível no momento.",
  "Client:": "Cliente:",
  "Client": "Cliente",
  "Budget": "Orçamento",
  "Status": "Status",
  "Start Date": "Data de início",
  "End Date": "Data de término",
  "Ends": "Termina em",
  "Details": "Detalhes",
  "Edit": "Editar",
  "Delete": "Excluir",
  "Save": "Salvar",
  "Cancel": "Cancelar",
  "Approve": "Aprovar",
  "Reject": "Rejeitar",
  "Mark Paid": "Marcar como pago",
  "Under Review": "Em análise",
  "In Voting": "Em votação",
  "Approved": "Aprovado",
  "Rejected": "Rejeitado",
  "Paid": "Pago",
  "Pending": "Pendente",
  "All": "Todos",
  "Actions": "Ações",
  "Name": "Nome",
  "Creator": "Criador",
  "Creator Name": "Nome do criador",
  "Campaign Name": "Nome da campanha",
  "Title": "Título",
  "Description": "Descrição",
  "Brief": "Briefing",
  "Tags": "Tags",
  "Required Tags": "Tags obrigatórias",
  "Platforms": "Plataformas",
  "Amount": "Valor",
  "Balance": "Saldo",
  "Available Balance": "Saldo disponível",
  "Requested": "Solicitado",
  "Requested At": "Solicitado em",
  "Paid At": "Pago em",
  "Created At": "Criado em",
  "Updated At": "Atualizado em",
  "View": "Ver",
  "View Details": "Ver detalhes",
  "View Submission": "Ver envio",
  "View Profile": "Ver perfil",
  "Connect TikTok": "Conectar TikTok",
  "Connect Instagram": "Conectar Instagram",
  "Connect YouTube": "Conectar YouTube",
  "Connected": "Conectado",
  "Disconnected": "Desconectado",
  "Connect": "Conectar",
  "Verify": "Verificar",
  "Verified": "Verificada",
  "Unverified": "Não verificada",
  "Add Page": "Adicionar página",
  "Add page": "Adicionar página",
  "Social Pages": "Páginas sociais",
  "Your Pages": "Suas páginas",
  "Page URL": "URL da página",
  "Handle": "Usuário",
  "No pages yet": "Nenhuma página ainda",
  "Error": "Erro",
  "Success": "Sucesso",
  "Failed to load campaigns": "Não foi possível carregar campanhas",
  "Failed to load approved pages": "Não foi possível carregar páginas aprovadas",
  "Failed to load TikTok videos": "Não foi possível carregar vídeos do TikTok",
  "Failed to create submission": "Não foi possível criar o envio",
  "You must be logged in to submit": "Você precisa estar logado para enviar",
  "TikTok connected, but no public videos were returned.": "TikTok conectado, mas nenhum vídeo público foi retornado.",
  "Missing login token. Please sign out and sign in again.": "Token de login ausente. Saia e entre novamente.",
  "No data available": "Nenhum dado disponível",
  "Total": "Total",
  "This month": "Este mês",
  "Last 30 days": "Últimos 30 dias",
  "Search": "Buscar",
  "Filter": "Filtrar",
  "Clear": "Limpar",
  "Back": "Voltar",
  "Next": "Próximo",
  "Previous": "Anterior",
  "Close": "Fechar",
  "Open": "Abrir"
};

const PLACEHOLDER_REPLACEMENTS: Record<string, string> = {
  "you@example.com": "voce@exemplo.com",
  "John Doe": "Nome Sobrenome",
  "Search campaigns...": "Buscar campanhas...",
  "Select a campaign": "Selecione uma campanha",
  "Select platform": "Selecione a plataforma",
  "Select one of your approved pages": "Selecione uma das suas páginas aprovadas",
  "https://instagram.com/p/...": "https://instagram.com/p/...",
  "Link to the audio used in your video...": "Link do áudio usado no seu vídeo...",
};

function shouldSkipElement(element: Element | null) {
  if (!element) return true;
  const tag = element.tagName.toLowerCase();
  return tag === "script" || tag === "style" || tag === "noscript" || element.closest("[data-no-translate]") !== null;
}

function replaceDelimitedText(value: string, from: string, to: string) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu");
  return value.replace(pattern, to);
}

function replaceTextNode(node: Text) {
  const parent = node.parentElement;
  if (shouldSkipElement(parent)) return;

  const original = node.nodeValue || "";
  const trimmed = original.trim();
  if (!trimmed) return;

  const exact = TEXT_REPLACEMENTS[trimmed];
  if (exact) {
    node.nodeValue = original.replace(trimmed, exact);
    return;
  }

  let updated = original;
  for (const [from, to] of Object.entries(TEXT_REPLACEMENTS)) {
    updated = replaceDelimitedText(updated, from, to);
  }
  if (updated !== original) node.nodeValue = updated;
}

function replaceAttributes(element: Element) {
  if (shouldSkipElement(element)) return;

  for (const attr of ["placeholder", "aria-label", "title", "alt"]) {
    const value = element.getAttribute(attr);
    if (!value) continue;

    const translated = PLACEHOLDER_REPLACEMENTS[value] || TEXT_REPLACEMENTS[value];
    if (translated) element.setAttribute(attr, translated);
  }
}

function walk(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  textNodes.forEach(replaceTextNode);

  if (root instanceof Element) replaceAttributes(root);
  root.querySelectorAll?.("*").forEach(replaceAttributes);
}

export function installPortugueseTextReplacements() {
  if (typeof window === "undefined") return;

  document.documentElement.lang = "pt-BR";

  const run = () => walk(document.body);
  if (document.body) run();
  else window.addEventListener("DOMContentLoaded", run, { once: true });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) replaceTextNode(node as Text);
        if (node.nodeType === Node.ELEMENT_NODE) walk(node as Element);
      });
    }
  });

  const startObserver = () => {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) startObserver();
  else window.addEventListener("DOMContentLoaded", startObserver, { once: true });
}
