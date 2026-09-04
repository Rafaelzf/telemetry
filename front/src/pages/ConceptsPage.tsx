type GlossaryEntry = {
  title: string;
  explanation: string;
  purpose: string;
};

const useCases: string[] = [
  'Descobrir que uma tela específica está quebrando para 5% dos usuários antes que eles abram um chamado de suporte.',
  'Medir se um deploy piorou o tempo de carregamento (LCP/FCP) ou a estabilidade visual (CLS) da aplicação.',
  'Saber quais rotas/telas são mais visitadas e em que ordem, para priorizar onde investir esforço de produto.',
  'Detectar picos de erro HTTP 5xx logo após um deploy, correlacionando com a versão publicada.',
  'Justificar decisões de performance com dados reais de usuário (RUM), não só com testes de laboratório.'
];

const benefits: string[] = [
  'Visibilidade: dá para ver o que está acontecendo em produção sem precisar reproduzir o problema localmente.',
  'Detecção precoce: erros e regressões de performance aparecem antes que virem reclamação de usuário.',
  'Dados objetivos: decisões de produto e engenharia passam a se apoiar em métricas reais, não em achismo.',
  'Baixo impacto: um SDK bem feito (não bloqueante, em lote, assíncrono) captura tudo isso sem travar a UI.',
  'Histórico: eventos persistidos permitem comparar hoje com semana passada, antes/depois de um deploy, etc.'
];

const glossary: GlossaryEntry[] = [
  {
    title: 'Telemetria',
    explanation:
      'Coleta automática de dados sobre o comportamento e a saúde de um sistema em execução — erros, tempos de carregamento, cliques, navegação — e o envio desses dados para um lugar central onde podem ser analisados.',
    purpose:
      'Enxergar o que está acontecendo de verdade em produção, para times de produto e engenharia tomarem decisões com base em dados reais de uso, não em suposição.'
  },
  {
    title: 'RUM (Real User Monitoring)',
    explanation:
      'Categoria de telemetria coletada diretamente do navegador de usuários reais (em vez de ambientes sintéticos de teste), capturando as condições reais de rede, dispositivo e uso.',
    purpose:
      'Ver a experiência como ela realmente é para o usuário final — um dispositivo lento ou uma rede ruim aparecem nos dados, o que um teste de laboratório não pega.'
  },
  {
    title: 'Evento de Erro (error)',
    explanation:
      'Registro disparado quando algo quebra: exceção JS não tratada, promise rejeitada sem catch, recurso (script/imagem) que falhou ao carregar, ou erro capturado por um Error Boundary do React.',
    purpose:
      'Saber que algo quebrou em produção — com stack trace e contexto — sem depender do usuário reportar manualmente.'
  },
  {
    title: 'Evento de Performance (performance)',
    explanation:
      'Registro de métricas de tempo/carregamento, como Web Vitals (LCP, FCP, CLS, aproximação de INP) e latência de chamadas HTTP.',
    purpose:
      'Medir se a aplicação está rápida e estável visualmente, e detectar regressões de performance entre versões.'
  },
  {
    title: 'Evento de Comportamento (behavior)',
    explanation:
      'Registro de ações do usuário, como navegação entre páginas (page view) — no schema do backend tem o formato action + payload.',
    purpose:
      'Entender como as pessoas navegam pelo produto: quais telas visitam, em que ordem, onde abandonam o fluxo.'
  },
  {
    title: 'Evento Customizado (custom)',
    explanation:
      'Evento definido livremente pela aplicação, fora dos tipos padrão — no schema do backend tem o formato name + payload.',
    purpose:
      'Rastrear algo específico do produto que não se encaixa nas categorias padrão (ex.: "usuário concluiu onboarding").'
  },
  {
    title: 'Page View',
    explanation:
      'Evento de comportamento disparado automaticamente sempre que a aplicação navega para uma nova rota — o core do SDK intercepta a History API para detectar isso sem precisar de código manual em cada página.',
    purpose:
      'Montar o funil de navegação da aplicação (quem foi de onde para onde) sem instrumentar cada tela na mão.'
  },
  {
    title: 'Web Vitals (LCP, FCP, CLS, INP)',
    explanation:
      'Conjunto de métricas padronizadas do Google para medir a experiência de carregamento e estabilidade de uma página: LCP (tempo até o maior elemento visível aparecer), FCP (tempo até o primeiro conteúdo aparecer), CLS (o quanto o layout "pula" sem o usuário interagir) e INP (o quão responsiva a página é às interações).',
    purpose:
      'Ter um vocabulário comum e comparável de "essa página está rápida/estável ou não", usado inclusive pelo Google para ranking de busca.'
  },
  {
    title: 'App ID',
    explanation:
      'Identificador que marca a qual aplicação um evento pertence — cada evento enviado carrega esse id, e as tabelas do banco têm uma foreign key para ele.',
    purpose:
      'Permitir que o mesmo backend de telemetria atenda várias aplicações diferentes, mantendo os dados de cada uma separados nas consultas.'
  },
  {
    title: 'Ingestão não bloqueante (fire-and-forget)',
    explanation:
      'Padrão em que o endpoint que recebe os eventos (POST /api/v1/telemetry) valida e enfileira a requisição, mas não espera ela ser persistida no banco antes de responder — responde 202 imediatamente.',
    purpose:
      'Não deixar a aplicação do usuário mais lenta por causa da telemetria — enviar eventos nunca deve travar a UI esperando um INSERT no banco.'
  },
  {
    title: 'Fila (Queue)',
    explanation:
      'Estrutura onde os eventos ficam temporariamente guardados, em ordem, entre o momento em que chegam (ingestão) e o momento em que são processados (persistidos no banco).',
    purpose:
      'Desacoplar "receber o evento" de "gravar o evento", permitindo absorver picos de tráfego sem perder dados nem travar a ingestão.'
  },
  {
    title: 'RPUSH',
    explanation:
      'Comando do Redis que insere um valor no final (right) de uma lista.',
    purpose:
      'É usado aqui para colocar cada novo lote de eventos no fim da fila `telemetry:queue:jobs`, assim que chegam na API.'
  },
  {
    title: 'LPOP',
    explanation:
      'Comando do Redis que remove e retorna o valor do início (left) de uma lista.',
    purpose:
      'É usado pelos loops de polling do worker para retirar o próximo lote de eventos da fila e processá-lo — junto com RPUSH, forma uma fila FIFO simples (primeiro que entra, primeiro que sai).'
  },
  {
    title: 'Polling',
    explanation:
      'Técnica de checar repetidamente (em intervalos de tempo) se há trabalho novo a fazer, em vez de ser avisado automaticamente quando algo muda.',
    purpose:
      'Como a API REST do Redis (Upstash) não oferece um "pop bloqueante" nem pub/sub, os loops do worker fazem polling (LPOP em intervalos) para simular uma fila que "acorda sozinha".'
  },
  {
    title: 'Upstash REST (Redis via HTTPS)',
    explanation:
      'Forma de acessar o Redis por chamadas HTTPS comuns, em vez da conexão TCP tradicional (porta 6379/rediss://).',
    purpose:
      'Neste projeto, a conexão TCP era bloqueada silenciosamente por firewalls corporativos (DPI) mesmo em redes diferentes — HTTPS/443 continuava acessível, então a fila inteira foi migrada para REST para garantir que funcione em qualquer rede.'
  },
  {
    title: 'Bulk insert',
    explanation:
      'Inserir várias linhas no banco de dados em uma única operação, em vez de uma query por linha.',
    purpose:
      'Persistir um lote inteiro de eventos de uma vez é muito mais eficiente do que fazer um INSERT por evento, reduzindo carga no Postgres.'
  },
  {
    title: 'Rate limiting',
    explanation:
      'Mecanismo que limita quantas requisições uma origem pode fazer em um período de tempo, rejeitando o excedente.',
    purpose:
      'Proteger a API de ingestão contra abuso ou bugs no cliente que enviem eventos demais, sem derrubar o serviço para os demais.'
  },
  {
    title: 'Validação por item (Zod)',
    explanation:
      'Cada evento de um lote é validado individualmente contra um schema (união discriminada por `type`) — um evento inválido é descartado e contado como rejeitado, sem invalidar o lote inteiro.',
    purpose:
      'Evitar que um único evento corrompido derrube a ingestão de todos os outros eventos daquele lote.'
  },
  {
    title: 'Cache-aside',
    explanation:
      'Padrão em que, antes de consultar o banco, primeiro se verifica se o resultado já está guardado em cache; se não estiver, consulta o banco e guarda o resultado em cache para as próximas vezes.',
    purpose:
      'Deixar os endpoints de métricas (`/metrics/errors`, `/metrics/performance`) mais rápidos e reduzir a carga repetida no Postgres para consultas iguais.'
  },
  {
    title: 'Batching (envio em lote)',
    explanation:
      'Agrupar vários eventos em um único envio de rede, em vez de mandar uma requisição HTTP por evento.',
    purpose:
      'Reduzir o número de requisições feitas pelo SDK no navegador, economizando rede e evitando sobrecarregar a API com tráfego desnecessário.'
  }
];

export function ConceptsPage() {
  return (
    <section>
      <h1>O que é Telemetria?</h1>
      <p>
        <strong>Telemetria</strong> é a coleta automática de dados sobre o comportamento e a saúde de uma aplicação
        enquanto ela roda de verdade, no dispositivo do usuário — e o envio desses dados para um lugar central onde
        podem ser armazenados e analisados. Na prática: cada erro que acontece, cada tela que demora para carregar,
        cada navegação entre páginas, vira um pequeno evento que é registrado.
      </p>

      <h2>Para que serve</h2>
      <p>
        Sem telemetria, um time só fica sabendo que algo deu errado quando um usuário reclama — e mesmo assim,
        raramente com detalhes suficientes para reproduzir o problema. Com telemetria, o próprio sistema reporta
        continuamente "como estou indo": quantos erros estão acontecendo, quão rápido as páginas carregam, por onde
        as pessoas navegam.
      </p>

      <h2>O que resolve</h2>
      <p>
        Resolve o problema da <strong>falta de visibilidade em produção</strong>. Ambientes de desenvolvimento e
        testes nunca reproduzem fielmente a variedade de dispositivos, redes e comportamentos dos usuários reais —
        telemetria fecha essa lacuna, trazendo dados de dentro do ambiente real de uso.
      </p>

      <h2>Para quais casos é usada</h2>
      <ul className="feature-list">
        {useCases.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>Benefícios</h2>
      <ul className="feature-list">
        {benefits.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>Glossário de conceitos</h2>
      <p className="note">
        Termos e conceitos de telemetria usados neste projeto (SDK e backend), explicados um a um.
      </p>

      <dl className="glossary-list">
        {glossary.map(({ title, explanation, purpose }) => (
          <div className="glossary-entry" key={title}>
            <dt>{title}</dt>
            <dd>
              <strong>Explicação:</strong> {explanation}
            </dd>
            <dd>
              <strong>Para que serve:</strong> {purpose}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
