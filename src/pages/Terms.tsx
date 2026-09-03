import { LegalPageLayout, type LegalSection } from "@/components/LegalPageLayout";

const sections: LegalSection[] = [
  {
    id: "aceitacao",
    title: "Aceitação dos termos",
    content: <p>Ao criar uma conta, conectar uma página social ou usar a Somma, você declara que leu e concorda com estes Termos de Serviço. Se você usa a plataforma em nome de uma empresa ou organização, declara que tem autorização para vinculá-la a estes termos.</p>,
  },
  {
    id: "elegibilidade",
    title: "Elegibilidade e conta",
    content: <><p>Você deve ter capacidade legal para contratar e fornecer informações verdadeiras, atuais e completas. Cada pessoa é responsável por proteger suas credenciais e por toda atividade realizada em sua conta.</p><p>Avise a Somma imediatamente se suspeitar de acesso não autorizado. Contas não podem ser vendidas, cedidas ou compartilhadas de forma que comprometa a segurança da plataforma.</p></>,
  },
  {
    id: "contas-sociais",
    title: "Contas sociais conectadas",
    content: <><p>A Somma permite conectar contas do Instagram, TikTok e YouTube por meio dos fluxos de autorização de cada plataforma. A conexão não fornece à Somma sua senha da rede social.</p><p>Você confirma que tem direito de administrar as contas conectadas e autoriza a Somma a acessar os dados permitidos durante a autorização, como identificadores do perfil ou canal, publicações e métricas públicas necessárias ao funcionamento do serviço. A conexão pode ser revogada nas configurações do respectivo provedor.</p></>,
  },
  {
    id: "campanhas",
    title: "Campanhas e envios",
    content: <><p>As campanhas podem definir requisitos próprios, incluindo plataformas aceitas, tags, prazos, limites, formato de conteúdo e critérios de aprovação. Antes de participar, confira todos os detalhes exibidos na campanha.</p><p>Um envio pode ser aprovado, rejeitado ou removido se estiver fora das regras da campanha, violar estes termos, infringir direitos de terceiros ou apresentar informações enganosas. A participação não garante aprovação nem pagamento.</p></>,
  },
  {
    id: "conteudo",
    title: "Conteúdo e propriedade intelectual",
    content: <><p>Você mantém a titularidade do conteúdo que cria. Ao enviar conteúdo para uma campanha, concede à Somma uma licença limitada, não exclusiva e sem transferência de propriedade para hospedar, exibir, revisar e processar esse conteúdo apenas para operar a plataforma, verificar a participação, calcular resultados e administrar a campanha.</p><p>Você declara possuir as autorizações necessárias sobre imagem, áudio, música, marcas e demais elementos utilizados. A Somma pode solicitar comprovações e remover conteúdo que aparente infringir direitos de terceiros.</p></>,
  },
  {
    id: "metricas",
    title: "Métricas e verificação",
    content: <><p>Métricas podem ser obtidas das APIs das plataformas conectadas, de dados públicos ou de verificações administrativas. Números podem sofrer atraso, arredondamento ou ajustes feitos pelo provedor original.</p><p>É proibido manipular visualizações, seguidores, curtidas ou qualquer indicador. A Somma pode desconsiderar métricas suspeitas, suspender a análise e solicitar informações adicionais.</p></>,
  },
  {
    id: "pagamentos",
    title: "Pagamentos e tributos",
    content: <><p>Valores, condições e critérios de pagamento são informados em cada campanha. Pagamentos dependem da aprovação do envio, da validação das métricas e do fornecimento correto dos dados necessários ao saque.</p><p>O criador é responsável por suas obrigações fiscais e pela exatidão dos dados bancários ou PIX. Prazos podem variar em caso de revisão de segurança, informações incompletas ou indisponibilidade de terceiros.</p></>,
  },
  {
    id: "conduta",
    title: "Uso aceitável",
    content: <><p>Você não pode usar a Somma para fraude, assédio, discriminação, violação de direitos, distribuição de malware, automação não autorizada, engenharia reversa, coleta indevida de dados ou tentativa de contornar controles de segurança.</p><p>Também é proibido se passar por outra pessoa, conectar contas sem autorização ou fornecer conteúdo e métricas falsos.</p></>,
  },
  {
    id: "suspensao",
    title: "Suspensão e encerramento",
    content: <p>A Somma pode limitar, suspender ou encerrar o acesso quando houver violação destes termos, risco à segurança, exigência legal, fraude suspeita ou dano a usuários e parceiros. Quando viável, informaremos o motivo e permitiremos a correção. Você pode deixar de usar o serviço e solicitar a exclusão da conta a qualquer momento.</p>,
  },
  {
    id: "terceiros",
    title: "Serviços de terceiros",
    content: <p>A plataforma se integra a serviços independentes, como redes sociais, autenticação, hospedagem e pagamentos. Esses serviços possuem termos e políticas próprios, e alterações, bloqueios ou indisponibilidades neles podem afetar funcionalidades da Somma.</p>,
  },
  {
    id: "responsabilidade",
    title: "Disponibilidade e responsabilidade",
    content: <><p>Buscamos manter o serviço seguro e disponível, mas não garantimos operação ininterrupta nem a permanência de integrações externas. Na máxima extensão permitida pela legislação aplicável, a Somma não responde por perdas indiretas, lucros cessantes ou danos causados por plataformas de terceiros.</p><p>Nada nestes termos exclui direitos ou responsabilidades que não possam ser limitados por lei.</p></>,
  },
  {
    id: "alteracoes-contato",
    title: "Alterações e contato",
    content: <><p>Estes termos podem ser atualizados para refletir mudanças no serviço, nas integrações ou na legislação. Quando a alteração for relevante, publicaremos a nova data de atualização e poderemos apresentar um aviso adicional.</p><p>Dúvidas podem ser enviadas para <a href="mailto:georgiaeick@g.ucla.edu">georgiaeick@g.ucla.edu</a>.</p></>,
  },
];

export default function Terms() {
  return <LegalPageLayout kind="terms" eyebrow="Acordo de uso" title="Termos de Serviço" description="As regras que mantêm campanhas, criadores e parceiros trabalhando com clareza e segurança dentro da Somma." sections={sections} />;
}
