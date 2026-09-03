import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";

const sections: LegalSection[] = [
  {
    id: "responsavel",
    title: "Quem trata seus dados",
    content: <p>A Somma é responsável pelo tratamento de dados pessoais realizado por meio desta plataforma. Para dúvidas, solicitações ou exercício de direitos de privacidade, entre em contato pelo e-mail <a href="mailto:georgiaeick@g.ucla.edu">georgiaeick@g.ucla.edu</a>.</p>,
  },
  {
    id: "dados-coletados",
    title: "Dados que coletamos",
    content: <><p>Podemos coletar nome, e-mail, identificadores de conta, dados de autenticação e segurança, preferências, tags de conteúdo, histórico de campanhas, envios, decisões de aprovação, pagamentos e dados necessários para saques.</p><p>Também recebemos informações técnicas, como endereço IP, tipo de dispositivo, navegador, registros de acesso e eventos de uso, para segurança, prevenção de fraude e melhoria do serviço.</p></>,
  },
  {
    id: "plataformas",
    title: "Dados de Instagram, TikTok e YouTube",
    content: <><p>Quando você conecta uma conta social, a autorização acontece na própria plataforma. Conforme as permissões aceitas, podemos receber identificadores do perfil ou canal, nome de usuário, URL, foto, publicações, metadados e métricas como visualizações, curtidas e comentários.</p><p>Podemos armazenar tokens de acesso protegidos para manter a sincronização autorizada. Não recebemos nem armazenamos sua senha da rede social. O acesso aos dados do Google e YouTube é usado somente para fornecer e melhorar as funções visíveis de conexão de canal, seleção de conteúdo e sincronização de métricas; não vendemos esses dados nem os utilizamos para publicidade personalizada.</p></>,
  },
  {
    id: "finalidades",
    title: "Como usamos as informações",
    content: <ul><li>Criar, autenticar e proteger sua conta.</li><li>Conectar e verificar páginas sociais autorizadas.</li><li>Exibir campanhas elegíveis e processar envios.</li><li>Sincronizar métricas, revisar conteúdo e calcular resultados.</li><li>Administrar pagamentos, saques e suporte.</li><li>Prevenir abuso, investigar falhas e cumprir obrigações legais.</li><li>Analisar o desempenho do produto de forma agregada e melhorar a experiência.</li></ul>,
  },
  {
    id: "bases-legais",
    title: "Bases legais",
    content: <p>Tratamos dados conforme a Lei Geral de Proteção de Dados Pessoais (LGPD), com fundamento, conforme o caso, na execução do contrato e de procedimentos solicitados por você, no consentimento, no cumprimento de obrigações legais ou regulatórias e em interesses legítimos compatíveis com seus direitos, como segurança, prevenção de fraude e melhoria do serviço.</p>,
  },
  {
    id: "compartilhamento",
    title: "Compartilhamento",
    content: <><p>Compartilhamos dados apenas quando necessário com fornecedores que apoiam autenticação, banco de dados, hospedagem, comunicação, análise, segurança e pagamentos; com administradores e responsáveis por campanhas na medida necessária para revisar participações; com as plataformas sociais conectadas; ou quando exigido por lei.</p><p>Esses destinatários devem tratar os dados de acordo com suas finalidades e obrigações aplicáveis. A Somma não vende dados pessoais.</p></>,
  },
  {
    id: "retencao",
    title: "Retenção, revogação e exclusão",
    content: <><p>Mantemos os dados pelo tempo necessário para prestar o serviço, concluir campanhas e pagamentos, cumprir obrigações legais, resolver disputas e prevenir fraude. Os prazos variam conforme a categoria e a finalidade.</p><p>Você pode revogar uma integração nas configurações da plataforma social correspondente. Isso interrompe novos acessos, mas não exclui automaticamente dados já tratados de forma legítima. Para solicitar exclusão da conta e dos dados aplicáveis, envie um e-mail para nosso contato de privacidade.</p></>,
  },
  {
    id: "seguranca",
    title: "Segurança",
    content: <p>Adotamos medidas técnicas e administrativas destinadas a proteger dados contra acesso não autorizado, perda, alteração e divulgação indevida, incluindo controles de acesso e proteção de credenciais e tokens. Nenhum sistema é completamente invulnerável; por isso, também monitoramos incidentes e atualizamos nossas práticas.</p>,
  },
  {
    id: "direitos",
    title: "Seus direitos",
    content: <><p>Nos termos da LGPD, você pode solicitar confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação quando aplicável, portabilidade, informações sobre compartilhamento, revisão de decisões automatizadas e revogação do consentimento.</p><p>Podemos pedir informações para confirmar sua identidade antes de atender a solicitação. Alguns dados poderão ser mantidos quando houver obrigação legal ou outra hipótese autorizada.</p></>,
  },
  {
    id: "cookies",
    title: "Cookies e dados técnicos",
    content: <p>Usamos cookies e tecnologias semelhantes necessários para manter sessões, autenticar usuários, preservar preferências e proteger a plataforma. Também podemos usar medições de desempenho de forma limitada. Você pode controlar cookies no navegador, mas bloquear os essenciais pode impedir o funcionamento de partes do serviço.</p>,
  },
  {
    id: "transferencias",
    title: "Transferências internacionais",
    content: <p>Alguns fornecedores e plataformas integradas podem processar dados fora do Brasil. Nesses casos, adotamos mecanismos e salvaguardas compatíveis com a legislação aplicável e avaliamos os fornecedores utilizados pela Somma.</p>,
  },
  {
    id: "menores",
    title: "Menores de idade",
    content: <p>A Somma não é destinada a crianças e não coleta intencionalmente dados de menores sem a autorização exigida. Se você acredita que um menor forneceu dados de forma inadequada, entre em contato para que possamos analisar e tomar as medidas necessárias.</p>,
  },
  {
    id: "atualizacoes",
    title: "Atualizações desta política",
    content: <p>Podemos atualizar esta política para refletir mudanças na plataforma, nas integrações ou na legislação. A versão vigente será sempre publicada nesta página com a data de atualização. Alterações relevantes poderão ser comunicadas também dentro do serviço.</p>,
  },
];

export default function Privacy() {
  return <LegalPageLayout kind="privacy" eyebrow="Privacidade por design" title="Política de Privacidade" description="Saiba quais dados a Somma trata, por que eles são necessários e como você pode exercer seus direitos." sections={sections} />;
}
