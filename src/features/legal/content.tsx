import type { ReactNode } from 'react';
import { CONTACT_EMAIL, LEGAL_PATHS } from './routes';

// Os textos ficam fora do bundle inicial: só a página legal (chunk próprio) importa este módulo.
const CONTROLLER = 'Henrique Abrahim Ramalho';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface LegalText {
  title: string;
  summary: ReactNode;
  sections: LegalSection[];
}

function Mail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

export const PRIVACY: LegalText = {
  title: 'Política de Privacidade',
  summary: (
    <ul>
      <li>Pedimos só o necessário para a sua conta: nome, e-mail e senha.</li>
      <li>Notificações e localização são opcionais e dependem da sua autorização.</li>
      <li>Não vendemos dados, não exibimos anúncios e não usamos cookies de rastreamento.</li>
      <li>
        Você baixa seus dados ou exclui a conta a qualquer momento, no menu da conta, e fala conosco
        por <Mail />.
      </li>
    </ul>
  ),
  sections: [
    {
      id: 'controlador',
      title: '1. Quem cuida dos seus dados',
      body: (
        <>
          <p>
            O Brasil Lens é um projeto independente mantido por {CONTROLLER}, pessoa física,
            controlador dos dados pessoais tratados no site, nos termos da Lei Geral de Proteção de
            Dados (Lei nº 13.709/2018, a LGPD).
          </p>
          <p>
            Para qualquer assunto sobre privacidade, inclusive para exercer os seus direitos,
            escreva para <Mail />. Como agente de tratamento de pequeno porte, o projeto não nomeia
            encarregado (Resolução CD/ANPD nº 2/2022, art. 11); esse endereço é o canal de
            comunicação com os titulares.
          </p>
        </>
      ),
    },
    {
      id: 'dados',
      title: '2. Que dados tratamos e para quê',
      body: (
        <dl className="legal-data">
          <dt>Conta</dt>
          <dd>
            Nome, e-mail, senha e tema (claro ou escuro). Servem para criar e proteger o seu acesso,
            controlar quem acessa os mapas e guardar suas preferências. A senha é guardada só como
            resumo criptográfico (scrypt): ninguém, nem o projeto, consegue lê-la. Base legal:
            execução do contrato que você aceita ao criar a conta (art. 7º, V).
          </dd>
          <dt>Sessão</dt>
          <dd>
            Um cookie estritamente necessário, <code>brasil_lens_session</code>, guarda um código
            aleatório que mantém você conectado por até 30 dias. O servidor guarda apenas o resumo
            desse código. Base legal: execução do contrato.
          </dd>
          <dt>Aceite dos documentos</dt>
          <dd>
            A versão desta Política e dos Termos de Uso que você aceitou e a data do aceite, para
            comprovar a concordância. Base legal: cumprimento de obrigação legal e exercício regular
            de direitos (art. 7º, II e VI).
          </dd>
          <dt>Municípios seguidos</dt>
          <dd>
            Os municípios que você segue e quando passou a segui-los. Base legal: execução do
            contrato.
          </dd>
          <dt>Notificações (opcionais)</dt>
          <dd>
            Ao ligar o sino de um município, o navegador cria uma inscrição de push (o endereço do
            serviço de notificações do navegador e as chaves que cifram as mensagens) e registramos
            a data da sua autorização. Guardamos também o histórico dos avisos gerados para você,
            para não repetir o mesmo aviso. Base legal: consentimento (art. 7º, I), que você revoga
            a qualquer momento pelo sino ou nas permissões do navegador.
          </dd>
          <dt>Localização (opcional)</dt>
          <dd>
            Ao tocar em localizar, o navegador pede a sua permissão e envia as coordenadas uma única
            vez, só para encontrar o município em que você está. As coordenadas não são gravadas.
            Base legal: consentimento.
          </dd>
          <dt>Registros técnicos</dt>
          <dd>
            Endereço IP, data e hora, página ou rota pedida e tipo de navegador ficam nos registros
            dos provedores de hospedagem. O IP também fica na memória do servidor por até 5 minutos
            para limitar tentativas de acesso. Servem à segurança, à prevenção de abusos e ao
            diagnóstico de falhas. Base legal: legítimo interesse (art. 7º, IX).
          </dd>
          <dt>No seu aparelho</dt>
          <dd>
            O tema e o último recorte do mapa ficam no armazenamento local do navegador, sem sair do
            seu aparelho.
          </dd>
          <dt>Doações por Pix</dt>
          <dd>
            Como em qualquer Pix, o banco mostra a quem recebe o nome de quem pagou. Esse dado não é
            ligado à sua conta e é usado só no controle financeiro e nas obrigações fiscais (art.
            7º, II).
          </dd>
        </dl>
      ),
    },
    {
      id: 'nao-fazemos',
      title: '3. O que não fazemos',
      body: (
        <p>
          Não vendemos nem alugamos dados pessoais, não exibimos publicidade, não usamos cookies de
          rastreamento nem ferramentas de análise de terceiros e não pedimos CPF, endereço, telefone
          ou dados sensíveis.
        </p>
      ),
    },
    {
      id: 'compartilhamento',
      title: '4. Com quem os dados são compartilhados',
      body: (
        <>
          <p>
            Só com os fornecedores que fazem o serviço funcionar, que tratam os dados em nome do
            projeto e conforme as instruções dele:
          </p>
          <ul>
            <li>Vercel: publica o site e repassa as requisições à API.</li>
            <li>Render: executa a API.</li>
            <li>Neon (na Amazon Web Services): hospeda o banco de dados.</li>
            <li>GitHub: executa a rotina periódica que envia os avisos.</li>
            <li>
              Serviços de push dos navegadores (Google, Apple, Mozilla, Microsoft): entregam as
              notificações e recebem o aviso já cifrado.
            </li>
          </ul>
          <p>
            Para desenhar o mapa, o seu navegador baixa imagens diretamente da Esri (relevo) e do
            INPE (focos de calor). Esses serviços recebem o seu IP, como acontece com qualquer site
            que carregue conteúdo deles.
          </p>
          <p>
            Dados também podem ser entregues a autoridades quando a lei ou uma ordem judicial
            exigir.
          </p>
        </>
      ),
    },
    {
      id: 'transferencia',
      title: '5. Transferência internacional',
      body: (
        <p>
          A API e o banco de dados ficam em servidores nos Estados Unidos. A transferência é
          necessária para executar o serviço que você pediu (art. 33, IX, combinado com o art. 7º,
          V, da LGPD) e é feita com fornecedores que adotam medidas contratuais e técnicas de
          proteção de dados.
        </p>
      ),
    },
    {
      id: 'prazos',
      title: '6. Por quanto tempo guardamos',
      body: (
        <ul>
          <li>Conta, preferências e municípios seguidos: até você excluir a conta.</li>
          <li>Sessões: 30 dias, ou até você sair da conta.</li>
          <li>
            Inscrições de push: até você desligar as notificações, sair, excluir a conta ou o
            serviço do navegador invalidar a inscrição.
          </li>
          <li>Histórico de avisos: apagado 30 dias depois que o aviso deixa de valer.</li>
          <li>IP para limitar tentativas: até 5 minutos, só na memória.</li>
          <li>
            Registros técnicos dos provedores: pelo prazo de retenção de cada provedor, em geral de
            alguns dias a poucas semanas.
          </li>
        </ul>
      ),
    },
    {
      id: 'direitos',
      title: '7. Seus direitos',
      body: (
        <>
          <p>
            A LGPD (art. 18) garante: confirmação de que tratamos seus dados e acesso a eles;
            correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de
            dados desnecessários; portabilidade; eliminação dos dados tratados com consentimento;
            informação sobre compartilhamento; e revogação do consentimento.
          </p>
          <p>
            No menu da conta, você mesmo <strong>baixa todos os seus dados</strong> (arquivo JSON) e{' '}
            <strong>exclui a conta</strong>. A exclusão apaga na hora a conta, as sessões, os
            municípios seguidos, as inscrições de push e o histórico de avisos; cópias de segurança
            automáticas do banco podem manter esses dados por alguns dias, até serem sobrescritas.
          </p>
          <p>
            Para os demais pedidos, escreva para <Mail /> a partir do e-mail da conta. Respondemos
            em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados
            (ANPD) em gov.br/anpd.
          </p>
        </>
      ),
    },
    {
      id: 'seguranca',
      title: '8. Segurança',
      body: (
        <p>
          Toda a comunicação usa HTTPS. Senhas e códigos de sessão são guardados só como resumos
          criptográficos, o cookie de sessão não é acessível a scripts e as tentativas de acesso são
          limitadas. Nenhum sistema é infalível: se acontecer um incidente que possa trazer risco ou
          dano relevante a você, avisaremos você e a ANPD, como manda o art. 48 da LGPD.
        </p>
      ),
    },
    {
      id: 'menores',
      title: '9. Crianças e adolescentes',
      body: (
        <p>
          O Brasil Lens não é dirigido a crianças. Para criar uma conta, é preciso ter 18 anos ou a
          autorização de um responsável legal. Se soubermos de uma conta de criança criada sem essa
          autorização, ela será excluída. Responsáveis podem pedir a exclusão por <Mail />.
        </p>
      ),
    },
    {
      id: 'mudancas',
      title: '10. Mudanças nesta Política',
      body: (
        <p>
          A data da versão vigente aparece no topo da página. Mudanças relevantes são avisadas no
          aplicativo e pedem um novo aceite antes de você continuar usando a conta.
        </p>
      ),
    },
  ],
};

export const TERMS: LegalText = {
  title: 'Termos de Uso',
  summary: (
    <ul>
      <li>O Brasil Lens é gratuito e reúne dados públicos oficiais num mapa, para consulta.</li>
      <li>
        As informações podem ter atrasos ou erros e não substituem os canais oficiais: em
        emergência, ligue 199 (Defesa Civil) ou 193 (Bombeiros).
      </li>
      <li>O acesso aos mapas exige uma conta pessoal, que pode ser suspensa em caso de abuso.</li>
      <li>Doações são voluntárias e não dão direito a nenhuma contrapartida.</li>
    </ul>
  ),
  sections: [
    {
      id: 'servico',
      title: '1. O serviço',
      body: (
        <p>
          O Brasil Lens (brasillens.com.br) é um projeto independente e gratuito, mantido por{' '}
          {CONTROLLER}, pessoa física, que organiza num mapa dados públicos de clima, meio ambiente,
          socioeconomia, eleições, transporte e educação do Brasil, do país ao município. Ao criar
          uma conta ou continuar a usá-la, você concorda com estes Termos e declara ter lido a{' '}
          <a href={LEGAL_PATHS.privacy}>Política de Privacidade</a>.
        </p>
      ),
    },
    {
      id: 'conta',
      title: '2. Conta e acesso',
      body: (
        <ul>
          <li>
            O acesso aos mapas exige uma conta pessoal e intransferível. Para criá-la, é preciso ter
            18 anos ou a autorização de um responsável legal.
          </li>
          <li>Informe dados verdadeiros e mantenha a sua senha em segredo.</li>
          <li>
            O projeto pode limitar, suspender ou encerrar contas que violem estes Termos ou ponham o
            serviço em risco, avisando sempre que possível.
          </li>
          <li>Você pode excluir a sua conta a qualquer momento, no menu da conta.</li>
        </ul>
      ),
    },
    {
      id: 'uso',
      title: '3. Uso permitido',
      body: (
        <>
          <p>Não é permitido:</p>
          <ul>
            <li>
              acessar o serviço de forma automatizada ou em volume que prejudique o seu
              funcionamento (os dados vêm de fontes oficiais, que podem ser consultadas
              diretamente);
            </li>
            <li>
              tentar contornar a autenticação, os limites de acesso ou outras proteções, ou explorar
              falhas de segurança (se encontrar uma, avise por <Mail />
              );
            </li>
            <li>usar a conta de outra pessoa ou se passar por alguém;</li>
            <li>usar o serviço para qualquer fim ilegal.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'informacoes',
      title: '4. As informações exibidas',
      body: (
        <>
          <p>
            Os dados vêm de fontes públicas, como IBGE, INMET, CEMADEN, INPE, ANA, TSE, INEP,
            MapBiomas, Open-Meteo e OpenStreetMap, e são exibidos como chegam delas, com indicação
            da fonte. Valores estimados aparecem marcados com “≈”. As fontes podem atrasar, mudar ou
            conter erros, e o serviço pode ficar sem uma delas.
          </p>
          <p>
            <strong>
              O Brasil Lens é uma ferramenta de consulta e não substitui os alertas e orientações
              oficiais.
            </strong>{' '}
            Em emergência, ligue 199 (Defesa Civil) ou 193 (Bombeiros) e siga as autoridades locais.
            Para receber os alertas oficiais da Defesa Civil por SMS, envie o seu CEP para 40199. As
            notificações do Brasil Lens podem atrasar ou não chegar.
          </p>
          <p>
            Os resultados eleitorais são os divulgados pelo TSE e aparecem sem nenhuma recomendação
            de voto nem apoio a candidatos ou partidos.
          </p>
        </>
      ),
    },
    {
      id: 'disponibilidade',
      title: '5. Disponibilidade',
      body: (
        <p>
          O serviço é oferecido como está e pode ficar fora do ar, mudar ou ser descontinuado. Em
          caso de encerramento, as contas serão avisadas com antecedência razoável.
        </p>
      ),
    },
    {
      id: 'responsabilidade',
      title: '6. Responsabilidade',
      body: (
        <p>
          Decisões tomadas com base no Brasil Lens são de quem as toma. O projeto não responde por
          falhas, atrasos ou erros das fontes oficiais e dos serviços de terceiros, nem por decisões
          tomadas exclusivamente com base nas informações exibidas, sem prejuízo dos direitos que a
          lei garante a você.
        </p>
      ),
    },
    {
      id: 'propriedade',
      title: '7. Fontes, marcas e código',
      body: (
        <p>
          Os dados pertencem às respectivas fontes e seguem as licenças delas, como a CC BY 4.0
          (MapBiomas e Open-Meteo) e a ODbL (OpenStreetMap), sempre com a atribuição exibida no
          mapa. O nome e a identidade visual do Brasil Lens pertencem ao projeto. O código-fonte é
          público no GitHub, e o uso dele segue a licença indicada em cada repositório.
        </p>
      ),
    },
    {
      id: 'doacoes',
      title: '8. Doações',
      body: (
        <p>
          As doações por Pix vão para a conta pessoal do mantenedor, são voluntárias, de qualquer
          valor e servem para pagar servidores, banco de dados e domínio. Elas não dão direito a
          nenhum benefício, recurso exclusivo ou contrapartida, não são dedutíveis do Imposto de
          Renda e não são reembolsáveis, salvo erro comprovado (escreva para <Mail />
          ).
        </p>
      ),
    },
    {
      id: 'mudancas',
      title: '9. Mudanças nos Termos',
      body: (
        <p>
          A data da versão vigente aparece no topo da página. Mudanças relevantes são avisadas no
          aplicativo e pedem um novo aceite; se você não concordar, pode excluir a conta.
        </p>
      ),
    },
    {
      id: 'lei',
      title: '10. Lei aplicável e contato',
      body: (
        <p>
          Estes Termos seguem a lei brasileira. Fica eleito o foro do seu domicílio para resolver
          qualquer conflito. Dúvidas, pedidos e avisos: <Mail />.
        </p>
      ),
    },
  ],
};
